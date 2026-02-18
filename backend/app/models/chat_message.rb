class ChatMessage < ApplicationRecord
  include StorageUploadable
  include WarehouseDocumentable
  warehouse_type :warehouse

  acts_as_tenant :tenant

  # Fallback folder path when tenant/config is unavailable
  FALLBACK_FOLDER_PATH = "Uncategorized/Chat".freeze

  # Cross-tenant chat: unscope user lookups so messages from Teeem support
  # (different tenant) still load the sender/recipient correctly
  belongs_to :user, -> { unscope(where: :tenant_id) }, optional: true
  belongs_to :recipient_user, -> { unscope(where: :tenant_id) }, class_name: "User", optional: true
  belongs_to :job, optional: true
  belongs_to :contact, optional: true
  belongs_to :legal_case, class_name: "CaseRecord", foreign_key: "case_id", optional: true

  belongs_to :chat_conversation, optional: true
  belongs_to :chat_guest_session, optional: true

  # SSoT: Link to deduplicated file storage (Jan 2026)
  belongs_to :storage_blob, optional: true

  # NOTE: has_one :warehouse_document is provided by WarehouseDocumentable concern

  # Constants
  MESSAGE_TYPES = %w[text image file].freeze

  validates :content, presence: true
  validates :message_type, inclusion: { in: MESSAGE_TYPES }, allow_nil: true

  # Ensure tenant_id is set from user before validation
  before_validation :set_tenant_from_user, on: :create
  # Auto-propagate job_id from guest session (client chats appear in Job > Coms)
  before_validation :set_job_from_guest_session, on: :create

  # Upload to storage after file is attached
  after_commit :upload_to_storage, on: [:create, :update], if: :should_upload_to_storage?

  scope :in_channel, ->(channel) { where(channel: channel).order(created_at: :asc) }
  scope :for_job, ->(job_id) { where(job_id: job_id).order(created_at: :asc) }
  scope :for_contact, ->(contact_id) { where(contact_id: contact_id).order(created_at: :asc) }
  scope :for_case, ->(case_id) { where(case_id: case_id).order(created_at: :asc) }
  scope :general, -> { where(channel: "general", recipient_user_id: nil).order(created_at: :asc) }
  scope :recent, ->(limit = 100) { order(created_at: :desc).limit(limit).reverse }
  scope :between_users, ->(user1_id, user2_id) {
    where(
      "(user_id = ? AND recipient_user_id = ?) OR (user_id = ? AND recipient_user_id = ?)",
      user1_id, user2_id, user2_id, user1_id
    ).order(created_at: :asc)
  }

  # Display name: user name for authenticated senders, guest_sender_name for guests
  def sender_display_name
    return guest_sender_name if guest_sender_name.present?
    user&.name || "Unknown"
  end

  def guest_message?
    chat_guest_session_id.present? && user_id.nil?
  end

  def as_json(options = {})
    json = super(options.merge(
      include: {
        user: {},
        job: {},
        contact: {},
        legal_case: {}
      },
      methods: [ :formatted_timestamp, :file_url, :sender_display_name ]
    ))
    json[:is_guest] = guest_message?
    json[:guest_sender_name] = guest_sender_name if guest_sender_name.present?
    json
  end

  # Returns the URL for the attached file (for image/file display)
  # SSoT: Uses presigned S3 URL for direct browser access (no backend hop)
  def file_url
    return nil unless storage_blob&.storage_path.present?
    tenant = resolve_tenant_for_config
    return nil unless tenant

    provider = DocumentProviders::S3Compatible.for_tenant(tenant)
    provider.download_url(storage_blob.storage_path, expires_in: 3600, disposition: :inline)
  rescue StandardError => e
    Rails.logger.error("[ChatMessage] Failed to generate file_url for #{id}: #{e.message}")
    nil
  end

  def formatted_timestamp
    if created_at.today?
      created_at.strftime("%I:%M %p")
    elsif created_at.year == Time.current.year
      created_at.strftime("%b %d at %I:%M %p")
    else
      created_at.strftime("%b %d, %Y at %I:%M %p")
    end
  end

  # Phase 4: Virtual folder path for File Warehouse
  # SSoT: Reads from WarehouseProvider.path_for(:chat)
  # Configure at: /settings/company/warehouse-config → Warehouse Folders
  # ⚠️ FRC (Jan 2026): Must use for_tenant(), not instance
  def virtual_folder_path
    tenant = resolve_tenant_for_config
    return FALLBACK_FOLDER_PATH unless tenant

    config = WarehouseProvider.for_tenant(tenant) rescue nil
    template = config&.path_for(:chat)
    return FALLBACK_FOLDER_PATH unless template

    year = (created_at || Time.current).year.to_s
    month = format("%02d", (created_at || Time.current).month)

    # SSoT: Determine context folder using WarehouseProvider paths (Jan 2026)
    context = if job_id.present?
                jobs_folder = config&.path_for(:jobs) || "Jobs"
                "#{jobs_folder}/#{job&.job_code || job_id}"
              elsif contact_id.present?
                contacts_folder = config&.path_for(:contacts) || "Contacts"
                "#{contacts_folder}/#{contact&.display_name || contact_id}"
              elsif case_id.present?
                cases_folder = config&.path_for(:cases) || "Cases"
                "#{cases_folder}/#{legal_case&.reference || case_id}"
              else
                "General"
              end

    result = template.dup
    result.gsub!("{{Context}}", context)
    result.gsub!("{{Year}}", year)
    result.gsub!("{{Month}}", month)
    result.gsub!(/\{\{[^}]+\}\}/, "")
    result.gsub!(%r{//+}, "/")
    result
  end

  # WarehouseDocumentable: display name for warehouse entry
  def warehouse_display_name
    storage_blob&.original_filename || "Chat attachment #{id}"
  end

  # WarehouseDocumentable: custom metadata for warehouse entry
  def warehouse_entry_metadata
    {
      chat_message_id: id,
      user_id: user_id,
      job_id: job_id,
      contact_id: contact_id,
      message_type: message_type
    }
  end

  def has_file?
    storage_blob_id.present? || storage_reference.present?
  end

  # ========================================
  # StorageBlob File Access (SSoT - Jan 2026)
  # ========================================

  def attach_file(content, filename:, content_type: nil)
    blob = StorageBlob.find_or_create_for_content!(
      content,
      filename: filename,
      content_type: content_type
    )

    storage_blob&.decrement_reference! if storage_blob_id.present?
    self.storage_blob = blob
    blob.increment_reference!
  end

  # Provider-agnostic storage reference (SSoT: storage_item_id)
  # SSoT: Prefer storage_item_id, fall back to storage_file_id
  def storage_reference
    storage_item_id.presence || storage_file_id
  end

  def download_file
    file_ref = storage_item_id.presence || storage_file_id
    return nil unless file_ref.present?

    result = download_from_storage(file_ref)
    result[:success] ? result[:content] : nil
  rescue StandardError => e
    Rails.logger.error("[ChatMessage] Storage download failed for #{id}: #{e.message}")
    nil
  end

  private

  # Set tenant from user on create (defense-in-depth)
  # acts_as_tenant normally sets this from ActsAsTenant.current_tenant,
  # but in ActionCable callbacks there may be no tenant context.
  def set_tenant_from_user
    self.tenant_id ||= user&.tenant_id || chat_guest_session&.tenant_id
  end

  # Auto-propagate job_id from guest session so client messages
  # appear in the job's Communications page EntityChat
  def set_job_from_guest_session
    return unless chat_guest_session_id.present? && job_id.nil?
    self.job_id ||= chat_guest_session&.job_id
  end

  # Resolve tenant for WarehouseProvider access (used by virtual_folder_path)
  # ⚠️ FRC (Jan 2026): Model callbacks don't have ActsAsTenant context
  # Derive tenant from: user → tenant, or job → tenant, or contact → tenant
  def resolve_tenant_for_config
    # Try user first (most common)
    if user&.respond_to?(:tenant) && user.tenant.present?
      return user.tenant
    end

    # Try job
    if job&.respond_to?(:tenant) && job.tenant.present?
      return job.tenant
    end

    # Try contact
    if contact&.respond_to?(:tenant) && contact.tenant.present?
      return contact.tenant
    end

    # Fall back to ActsAsTenant if available
    ActsAsTenant.current_tenant
  end

  def should_upload_to_storage?
    # Upload only happens when storage_blob is assigned but not yet uploaded
    storage_blob.present? && storage_blob.storage_path.blank?
  end

  def upload_to_storage
    ChatMessageStorageUploadJob.perform_later(id)
  end
end
