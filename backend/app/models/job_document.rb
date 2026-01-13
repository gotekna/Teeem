class JobDocument < ApplicationRecord
  include StorableDocument

  # SSoT: Storage scope for this document type
  # Determines path: /Jobs/{JobCode}/{TabName}/filename
  storage_scope :job

  belongs_to :job
  belongs_to :document_type, optional: true
  belongs_to :ai_suggested_type, class_name: "DocumentType", optional: true
  belongs_to :rename_approved_by, class_name: "User", optional: true
  belongs_to :contact, optional: true  # For client/customer contact
  belongs_to :company, class_name: "CorporateCompany", foreign_key: "company_id", optional: true
  belongs_to :user_validated_by, class_name: "User", optional: true

  # Version chain associations (Draft/Signed versioning)
  belongs_to :parent_document, class_name: "JobDocument", optional: true
  has_many :child_versions, class_name: "JobDocument", foreign_key: :parent_document_id, dependent: :nullify
  belongs_to :signed_by, class_name: "User", optional: true

  # Version status constants
  VERSION_STATUSES = %w[draft signed superseded].freeze

  # Active Storage for file upload (for migrated documents)
  has_one_attached :file

  # File upload validation (security: prevents storage DoS and malware upload)
  ALLOWED_CONTENT_TYPES = %w[
    application/pdf
    image/jpeg image/png image/tiff image/heic
    application/vnd.openxmlformats-officedocument.wordprocessingml.document
    application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
    application/vnd.ms-excel application/msword
    text/plain text/csv
    application/octet-stream
  ].freeze

  validates :file, content_type: ALLOWED_CONTENT_TYPES,
                   size: { less_than: 100.megabytes, message: "must be less than 100MB" }

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
  validates :version_status, inclusion: { in: VERSION_STATUSES }

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

  # Version scopes (Draft/Signed versioning)
  scope :drafts, -> { where(version_status: 'draft') }
  scope :signed, -> { where(version_status: 'signed') }
  scope :superseded, -> { where(version_status: 'superseded') }
  scope :latest_versions, -> { where(version_status: %w[draft signed]) }
  scope :root_documents, -> { where(parent_document_id: nil) }
  scope :versionable, -> { joins(:document_type).where(document_types: { supports_versioning: true }) }

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

  # Version status helpers
  def draft?
    version_status == 'draft'
  end

  def signed?
    version_status == 'signed'
  end

  def superseded?
    version_status == 'superseded'
  end

  # Check if this document has a signed version (only applies to drafts)
  def has_signed_version?
    return false unless draft?
    child_versions.signed.exists?
  end

  # Get the latest version in this version chain
  def latest_version
    # If this is a child version, go to the root first
    root = root_document

    # Look for signed version first, then latest draft
    root.child_versions.signed.order(created_at: :desc).first ||
      root.child_versions.drafts.order(created_at: :desc).first ||
      root
  end

  # Get the root document in this version chain
  def root_document
    parent_document || self
  end

  # Get all versions in this version chain (including self)
  def all_versions
    root = root_document
    [root] + root.child_versions.order(version_number: :asc).to_a
  end

  # Check if this document's type supports versioning
  def versionable?
    document_type&.versionable? || false
  end

  # Create a signed version of this draft document
  # Returns the new signed document
  def create_signed_version!(file_params, signed_by_user:)
    raise ArgumentError, "Document type does not support versioning" unless versionable?
    raise ArgumentError, "Only draft documents can have signed versions" unless draft?

    # Mark this draft as superseded
    update!(version_status: 'superseded')

    # Create the signed version
    signed_version = self.class.create!(
      job: job,
      document_type: document_type,
      parent_document: root_document,
      version_status: 'signed',
      version_number: all_versions.count + 1,
      signed_at: Time.current,
      signed_by: signed_by_user,
      file_name: file_params[:file_name],
      file_extension: file_params[:file_extension],
      file_size: file_params[:file_size],
      sharepoint_item_id: file_params[:sharepoint_item_id],
      folder_path: folder_path,
      sync_status: 'synced',
      contact: contact,
      company: company
    )

    signed_version
  end

  private

  # SSoT: Default tokens for storage path template
  # Template: /Jobs/{JobCode}/{TabName}/filename
  def default_storage_tokens
    {
      JobCode: job&.job_code || "UNKNOWN",
      TabName: folder_path&.split("/")&.first || document_type&.name || "Documents"
    }
  end

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
