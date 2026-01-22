class PeopleDocument < ApplicationRecord
  include StorableDocument
  include DocumentStorageConstants
  include WarehouseDocumentable
  warehouse_type :people

  # SSoT: Storage scope for this document type
  # Determines path: /Corporate/People/{ContactName}/{TabName}/filename
  storage_scope :people

  # Associations
  belongs_to :contact
  belongs_to :document_type_record, class_name: "DocumentType", foreign_key: "document_type_id", optional: true

  # SSoT: Link to deduplicated file storage (Jan 2026)
  # Same file = same StorageBlob, deduplication via content_hash
  belongs_to :storage_blob, optional: true

  # ActiveStorage has_one_attached :file was REMOVED (Jan 2026) - it violated SSoT by
  # duplicating storage location. Files now stored via StorageBlob (belongs_to :storage_blob)
  # which deduplicates via content_hash and uses StorageConfiguration for provider-agnostic paths.

  # Phase 3: Universal warehouse metadata (SSoT for display_name, send_name, folder)
  # NOTE: has_one :warehouse_document is now provided by WarehouseDocumentable concern

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

  # Document types for identity documents
  IDENTITY_DOCUMENT_TYPES = %w[
    passport
    drivers_license
    birth_certificate
    citizenship_certificate
    medicare_card
    proof_of_age
    visa
    work_permit
  ].freeze

  # SSoT: STORAGE_PROVIDERS, MIGRATION_STATUSES defined in DocumentStorageConstants concern

  # Validations
  validates :title, presence: true
  validates :document_type, presence: true
  validates :contact_id, presence: true
  validates :storage_provider, inclusion: { in: STORAGE_PROVIDERS }, allow_nil: true
  validates :migration_status, inclusion: { in: MIGRATION_STATUSES }, allow_nil: true
  validate :must_be_identity_document

  # Scopes
  scope :for_contact, ->(contact_id) { where(contact_id: contact_id) }
  scope :by_type, ->(type) { where(document_type: type) }
  scope :recent, -> { order(created_at: :desc) }
  scope :by_content_hash, ->(hash) { where(content_hash: hash) if hash.present? }
  scope :expiring_soon, ->(days = 90) {
    where("expiry_date IS NOT NULL AND expiry_date BETWEEN ? AND ?", Date.today, Date.today + days.days)
  }
  scope :expired, -> { where("expiry_date < ?", Date.today) }
  # Migration scopes
  scope :migration_pending, -> { where(migration_status: 'pending') }
  scope :migration_in_progress, -> { where(migration_status: 'in_progress') }
  scope :migration_completed, -> { where(migration_status: 'completed') }
  scope :migration_failed, -> { where(migration_status: 'failed') }
  scope :needs_migration, -> { where(migration_status: [nil, 'failed']) }
  scope :on_provider, ->(provider) { where(storage_provider: provider) }

  # Callbacks
  before_save :standardize_document_type

  # Instance methods
  def formatted_document_type
    document_type.to_s.titleize.gsub("_", " ")
  end

  def file_size_mb
    return nil unless file_size.present?
    (file_size.to_f / 1024 / 1024).round(2)
  end

  def display_name
    title
  end

  def expired?
    expiry_date.present? && expiry_date < Date.today
  end

  def expiring_soon?(days = 90)
    return false unless expiry_date.present?
    expiry_date.between?(Date.today, Date.today + days.days)
  end

  def days_until_expiry
    return nil unless expiry_date.present?
    (expiry_date - Date.today).to_i
  end

  # Find an existing document by content hash
  def self.find_by_content_hash(hash)
    return nil if hash.blank?
    by_content_hash(hash).first
  end

  # Check if a duplicate exists anywhere in the system
  def self.duplicate_exists?(hash)
    return false if hash.blank?
    by_content_hash(hash).exists?
  end

  # Find all documents with matching content (duplicates)
  def find_duplicates
    return PeopleDocument.none if content_hash.blank?
    PeopleDocument.by_content_hash(content_hash).where.not(id: id)
  end

  def has_duplicates?
    find_duplicates.exists?
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

  # SSoT: storage_reference is now defined in StorableDocument concern

  # Sets both provider-agnostic fields
  def set_storage_reference(item_id, provider: 'sharepoint', path: nil)
    self.storage_item_id = item_id
    self.storage_provider = provider
    self.storage_path = path
  end

  # ========================================
  # StorageBlob File Access (SSoT)
  # ========================================

  # Check if document has an attached file
  def has_file?
    storage_blob_id.present?
  end

  # Get presigned download URL for the file
  # @param expires_in [Integer] Expiry time in seconds (default: 3600)
  # @return [String, nil] Presigned download URL or nil if no file
  def file_url(expires_in: 3600)
    return nil unless storage_blob

    storage_blob.presigned_url(expires_in: expires_in, filename: file_name)
  end

  # Download file content from storage
  # @return [String, nil] File content or nil if no file
  def download_file
    return nil unless storage_blob

    storage_blob.download
  end

  # Attach a file using StorageBlob (deduplication via content_hash)
  # @param content [String] File content
  # @param filename [String] Original filename
  # @param content_type [String] MIME type (optional)
  def attach_file(content, filename:, content_type: nil)
    blob = StorageBlob.find_or_create_for_content!(
      content,
      filename: filename,
      content_type: content_type
    )

    # Update reference counts
    storage_blob&.decrement_reference! if storage_blob_id.present?
    self.storage_blob = blob
    blob.increment_reference!

    # Update document metadata
    self.file_name = filename
    self.file_size = content.bytesize
    self.mime_type = content_type || blob.content_type
  end

  private

  # SSoT: Default tokens for storage path template
  # Template: /Corporate/People/{ContactName}/{TabName}/filename
  def default_storage_tokens
    {
      ContactName: contact&.display_name || "Unknown",
      TabName: folder || document_type&.titleize || "Identity"
    }
  end

  def must_be_identity_document
    return if document_type.blank?

    # Allow any document type from DocumentType table, or legacy identity types
    valid_types = IDENTITY_DOCUMENT_TYPES
    valid_types += DocumentType.pluck(:name).map(&:downcase) rescue []

    unless valid_types.include?(document_type.downcase)
      errors.add(:document_type, "must be an identity document type (passport, driver's license, etc.)")
    end
  end

  def standardize_document_type
    return if document_type.blank?

    # Standardize common variations
    case document_type.downcase
    when "driver's license", "drivers licence", "driver license", "dl"
      self.document_type = "drivers_license"
    when "birth cert", "birth certificate"
      self.document_type = "birth_certificate"
    when "citizenship cert"
      self.document_type = "citizenship_certificate"
    end
  end
end
