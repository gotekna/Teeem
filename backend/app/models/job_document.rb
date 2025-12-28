class JobDocument < ApplicationRecord
  belongs_to :job
  belongs_to :document_type, optional: true
  belongs_to :ai_suggested_type, class_name: "DocumentType", optional: true
  belongs_to :rename_approved_by, class_name: "User", optional: true
  belongs_to :contact, optional: true  # For client/customer contact
  belongs_to :company, class_name: "CorporateCompany", foreign_key: "company_id", optional: true
  belongs_to :user_validated_by, class_name: "User", optional: true

  # Active Storage for file upload (for migrated documents)
  has_one_attached :file

  # Activity log
  has_many :document_activities, as: :document, dependent: :destroy

  # Case links
  has_many :case_documents, as: :document, dependent: :destroy
  has_many :cases, through: :case_documents, source: :case_record

  # Duplicate tracking
  has_many :duplicate_reviews_as_existing,
           class_name: "DocumentDuplicateReview",
           foreign_key: :existing_document_id,
           as: :existing_document,
           dependent: :destroy
  has_many :duplicate_reviews_as_new,
           class_name: "DocumentDuplicateReview",
           foreign_key: :new_document_id,
           as: :new_document,
           dependent: :nullify

  # File type enum based on extension
  FILE_TYPE_MAP = {
    "rvt" => "revit_project",
    "rfa" => "revit_family",
    "dwg" => "autocad",
    "dxf" => "autocad_export",
    "dwfx" => "design_web",
    "pdf" => "pdf",
    "jpg" => "image",
    "jpeg" => "image",
    "png" => "image",
    "heic" => "image",
    "xlsx" => "spreadsheet",
    "xls" => "spreadsheet",
    "docx" => "document",
    "doc" => "document"
  }.freeze

  # Sync status enum
  SYNC_STATUSES = %w[pending synced missing error].freeze

  # AI verification statuses
  AI_VERIFICATION_STATUSES = %w[pending verified mismatch needs_review].freeze

  # Storage providers (SSoT: Organization.document_provider)
  STORAGE_PROVIDERS = %w[sharepoint s3_compatible].freeze

  # Migration statuses for tracking provider-to-provider migration
  MIGRATION_STATUSES = %w[pending in_progress completed failed].freeze

  validates :sharepoint_item_id, presence: true, uniqueness: true
  validates :storage_provider, inclusion: { in: STORAGE_PROVIDERS }, allow_nil: true
  validates :migration_status, inclusion: { in: MIGRATION_STATUSES }, allow_nil: true

  # Provider-agnostic storage reference
  # This is the new SSoT for document storage references
  # Backwards-compatible with sharepoint_item_id for existing documents
  validates :file_name, presence: true
  validates :sync_status, inclusion: { in: SYNC_STATUSES }
  validates :ai_verification_status, inclusion: { in: AI_VERIFICATION_STATUSES }, allow_blank: true

  # Scopes
  scope :cad_files, -> { where(file_type: %w[revit_project revit_family autocad autocad_export design_web]) }
  scope :documents, -> { where(file_type: %w[pdf document]) }
  scope :images, -> { where(file_type: "image") }
  scope :spreadsheets, -> { where(file_type: "spreadsheet") }
  scope :in_folder, ->(folder) { where("folder_path LIKE ?", "%#{folder}%") }
  scope :synced, -> { where(sync_status: "synced") }
  scope :needs_sync, -> { where(sync_status: %w[pending error]) }
  scope :for_job, ->(job_id) { where(job_id: job_id) }
  scope :for_contact, ->(contact_id) { where(contact_id: contact_id) }
  scope :for_company, ->(company_id) { where(company_id: company_id) }
  scope :by_financial_year, ->(year) { where("financial_years @> ARRAY[?]::integer[]", year.to_i) }
  scope :by_content_hash, ->(hash) { where(content_hash: hash) if hash.present? }
  scope :migrated_from_corporate, -> { where.not(legacy_corporate_document_id: nil) }
  scope :sharepoint_sourced, -> { where(source: "sharepoint").or(where(source: "onedrive")).or(where(source: nil)) }
  scope :manually_uploaded, -> { where(source: "manual") }

  # Migration scopes
  scope :migration_pending, -> { where(migration_status: 'pending') }
  scope :migration_in_progress, -> { where(migration_status: 'in_progress') }
  scope :migration_completed, -> { where(migration_status: 'completed') }
  scope :migration_failed, -> { where(migration_status: 'failed') }
  scope :needs_migration, -> { where(migration_status: [nil, 'failed']) }
  scope :on_provider, ->(provider) { where(storage_provider: provider) }

  # Callbacks
  before_save :set_file_extension
  before_save :set_file_type
  before_save :auto_detect_document_type

  # Determine file type from extension
  def self.file_type_for(extension)
    ext = extension.to_s.downcase.delete_prefix(".")
    FILE_TYPE_MAP[ext] || "other"
  end

  # Detect document type based on file extension
  def detect_document_type
    return nil if file_extension.blank?

    ext = ".#{file_extension.downcase}"
    DocumentType.where(scope: %w[job both])
                .where("? = ANY(file_extensions)", ext)
                .first
  end

  # Check if this is a CAD/BIM file
  def cad_file?
    %w[revit_project revit_family autocad autocad_export design_web].include?(file_type)
  end

  # Format file size for display
  def formatted_size
    return nil unless file_size

    if file_size >= 1.gigabyte
      "#{(file_size.to_f / 1.gigabyte).round(2)} GB"
    elsif file_size >= 1.megabyte
      "#{(file_size.to_f / 1.megabyte).round(1)} MB"
    elsif file_size >= 1.kilobyte
      "#{(file_size.to_f / 1.kilobyte).round(0)} KB"
    else
      "#{file_size} B"
    end
  end

  # Find an existing document by content hash
  def self.find_by_content_hash(hash)
    return nil if hash.blank?
    by_content_hash(hash).first
  end

  # Check if a duplicate exists
  def self.duplicate_exists?(hash)
    return false if hash.blank?
    by_content_hash(hash).exists?
  end

  # Find all documents with matching content (duplicates)
  def find_duplicates
    return JobDocument.none if content_hash.blank?
    JobDocument.by_content_hash(content_hash).where.not(id: id)
  end

  def has_duplicates?
    find_duplicates.exists?
  end

  # Check if this is a migrated document (vs SharePoint synced)
  def migrated?
    legacy_corporate_document_id.present?
  end

  # Check if this is SharePoint sourced
  def sharepoint_sourced?
    !migrated? && sharepoint_item_id.present?
  end

  # Provider-agnostic storage helpers
  # Returns true if stored in S3-compatible storage
  def s3_stored?
    storage_provider == 's3_compatible'
  end

  # Migration helpers
  def migration_in_progress?
    migration_status == 'in_progress'
  end

  def migration_completed?
    migration_status == 'completed'
  end

  def migration_failed?
    migration_status == 'failed'
  end

  def can_migrate?
    !migration_in_progress? && storage_reference.present?
  end

  # Returns the provider-agnostic storage reference
  # Falls back to sharepoint_item_id for backwards compatibility
  def storage_reference
    storage_item_id.presence || sharepoint_item_id
  end

  # Sets both provider-agnostic and SharePoint-specific fields
  # for backwards compatibility during migration
  def set_storage_reference(item_id, provider: 'sharepoint', path: nil)
    self.storage_item_id = item_id
    self.storage_provider = provider
    self.storage_path = path

    # Maintain backwards compatibility with SharePoint fields
    if provider == 'sharepoint'
      self.sharepoint_item_id = item_id
    end
  end

  private

  def set_file_extension
    return if file_extension.present? || file_name.blank?

    self.file_extension = File.extname(file_name).delete_prefix(".").downcase
  end

  def set_file_type
    return if file_type.present?

    self.file_type = self.class.file_type_for(file_extension)
  end

  def auto_detect_document_type
    return if document_type_id.present?

    detected = detect_document_type
    self.document_type = detected if detected
  end
end
