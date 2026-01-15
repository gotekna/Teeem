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

  has_one_attached :file

  validates :content, presence: true
  validates :message_type, inclusion: { in: %w[text image file] }, allow_nil: true

  # Upload to storage after file is attached
  after_commit :upload_to_storage, on: [:create, :update], if: :should_upload_to_storage?

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
  def file_url
    return nil unless file.attached?
    # Use rails_blob_url with default URL options (configured per environment)
    Rails.application.routes.url_helpers.rails_blob_url(file, only_path: false)
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

  def has_file?
    storage_reference.present?
  end

  # Provider-agnostic storage reference (SSoT: storage_item_id)
  # Falls back to sharepoint_file_id for backwards compatibility
  def storage_reference
    storage_item_id.presence || sharepoint_file_id
  end

  def set_storage_reference(item_id, provider: "sharepoint")
    self.storage_item_id = item_id
  end

  def download_file
    file_ref = storage_item_id.presence || sharepoint_file_id
    return nil unless file_ref.present?

    result = download_from_storage(file_ref)
    result[:success] ? result[:content] : nil
  rescue StandardError => e
    Rails.logger.error("[ChatMessage] Storage download failed for #{id}: #{e.message}")
    nil
  end

  private

  def should_upload_to_storage?
    file.attached? && sharepoint_file_id.blank?
  end

  def upload_to_storage
    ChatMessageStorageUploadJob.perform_later(id)
  end
end
