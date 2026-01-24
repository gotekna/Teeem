class ChatMessage < ApplicationRecord
  include StorageUploadable

  belongs_to :user
  belongs_to :project, optional: true
  belongs_to :recipient_user, class_name: "User", optional: true
  belongs_to :job, optional: true
  belongs_to :contact, optional: true
  belongs_to :legal_case, class_name: "CaseRecord", foreign_key: "case_id", optional: true

  # SSoT: Link to deduplicated file storage (Jan 2026)
  belongs_to :storage_blob, optional: true

  # Phase 4: Universal warehouse metadata (SSoT for display_name, folder)
  # Chat messages with files appear under Warehousing/Chat folder in File Warehouse
  has_one :warehouse_document, as: :documentable, dependent: :destroy

  # ActiveStorage has_one_attached :file was REMOVED (Jan 2026) - SSoT is storage_blob
  # Files stored via StorageBlob with deduplication via content_hash

  validates :content, presence: true
  validates :message_type, inclusion: { in: %w[text image file] }, allow_nil: true

  # Upload to storage after file is attached
  after_commit :upload_to_storage, on: [:create, :update], if: :should_upload_to_storage?
  after_create :create_warehouse_entry

  scope :in_channel, ->(channel) { where(channel: channel).order(created_at: :asc) }
  scope :for_project, ->(project_id) { where(project_id: project_id).order(created_at: :asc) }
  scope :for_job, ->(job_id) { where(job_id: job_id).order(created_at: :asc) }
  scope :for_contact, ->(contact_id) { where(contact_id: contact_id).order(created_at: :asc) }
  scope :for_case, ->(case_id) { where(case_id: case_id).order(created_at: :asc) }
  scope :general, -> { where(channel: "general", project_id: nil, recipient_user_id: nil).order(created_at: :asc) }
  scope :recent, ->(limit = 100) { order(created_at: :desc).limit(limit).reverse }
  scope :between_users, ->(user1_id, user2_id) {
    where(
      "(user_id = ? AND recipient_user_id = ?) OR (user_id = ? AND recipient_user_id = ?)",
      user1_id, user2_id, user2_id, user1_id
    ).order(created_at: :asc)
  }

  def as_json(options = {})
    super(options.merge(
      include: {
        user: {},
        job: {},
        contact: {},
        legal_case: {}
      },
      methods: [ :formatted_timestamp, :file_url ]
    ))
  end

  # Returns the URL for the attached file (for image/file display)
  # SSoT: Uses storage_blob for file access
  def file_url
    return nil unless storage_blob.present?
    # Generate URL via DocumentStorageService
    Rails.application.routes.url_helpers.api_v1_document_storage_download_url(
      scope: "chat_messages",
      record_id: id,
      host: Rails.application.routes.default_url_options[:host] || "localhost"
    )
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
  # SSoT: Reads from StorageConfiguration.virtual_template_for(:chat)
  # Configure at: /settings/company/entity-config → Storage Config
  def virtual_folder_path
    config = StorageConfiguration.instance
    template = config&.virtual_template_for(:chat)
    return "Warehousing/Chat/Unknown" unless template

    year = (created_at || Time.current).year.to_s
    month = format("%02d", (created_at || Time.current).month)

    # SSoT: Determine context folder using StorageConfiguration paths (Jan 2026)
    context = if job_id.present?
                jobs_folder = config&.path_for(:jobs) || "Jobs"
                "#{jobs_folder}/#{job&.job_code || job_id}"
              elsif contact_id.present?
                contacts_folder = config&.path_for(:contacts) || "Contacts"
                "#{contacts_folder}/#{contact&.display_name || contact_id}"
              elsif project_id.present?
                "Projects/#{project&.name || project_id}"
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

  # Display name for File Warehouse
  def display_name_for_warehouse
    storage_blob&.original_filename || "Chat attachment #{id}"
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
  # Falls back to sharepoint_file_id for backwards compatibility
  def storage_reference
    storage_item_id.presence || storage_file_id
  end

  def set_storage_reference(item_id, provider: "sharepoint")
    self.storage_item_id = item_id
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

  # Create WarehouseDocument entry for chat messages with files
  def create_warehouse_entry
    return unless storage_blob

    create_warehouse_document!(
      source_type: "warehouse",
      folder: virtual_folder_path,
      display_name: display_name_for_warehouse,
      original_filename: storage_blob.original_filename,
      storage_blob: storage_blob,
      metadata: {
        chat_message_id: id,
        user_id: user_id,
        job_id: job_id,
        contact_id: contact_id,
        project_id: project_id,
        message_type: message_type
      }
    )
  rescue StandardError => e
    Rails.logger.error("[ChatMessage] Failed to create warehouse entry: #{e.message}")
  end

  def should_upload_to_storage?
    # Upload only happens when storage_blob is assigned but not yet uploaded
    storage_blob.present? && storage_blob.storage_path.blank?
  end

  def upload_to_storage
    ChatMessageStorageUploadJob.perform_later(id)
  end
end
