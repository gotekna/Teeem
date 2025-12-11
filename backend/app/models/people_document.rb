class PeopleDocument < ApplicationRecord
  # Associations
  belongs_to :contact
  belongs_to :document_type_record, class_name: "DocumentType", foreign_key: "document_type_id", optional: true

  # Active Storage for file upload
  has_one_attached :file

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

  # Validations
  validates :title, presence: true
  validates :document_type, presence: true
  validates :contact_id, presence: true
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

  private

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
