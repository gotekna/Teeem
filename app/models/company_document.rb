class CompanyDocument < ApplicationRecord
  # Associations
  belongs_to :company, class_name: "CorporateCompany", foreign_key: "company_id"
  belongs_to :document_type_record, class_name: "DocumentType", foreign_key: "document_type_id", optional: true
  belongs_to :user_validated_by, class_name: "User", optional: true
  belongs_to :asset, optional: true
  belongs_to :loan, class_name: "CorporateCompanyLoan", optional: true

  # Polymorphic association
  belongs_to :documentable, polymorphic: true, optional: true

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

  # Active Storage for file upload
  has_one_attached :file

  # Storage types for Company Register tracking
  STORAGE_TYPES = %w[manual electronic both].freeze

  # AI verification statuses
  AI_VERIFICATION_STATUSES = %w[pending verified mismatch needs_review].freeze

  # Validations
  validates :title, presence: true
  validates :document_type, presence: true
  validates :company_id, presence: true
  validates :storage_type, inclusion: { in: STORAGE_TYPES }, allow_blank: true

  # Scopes
  scope :for_company, ->(company_id) { where(company_id: company_id) }
  scope :by_type, ->(type) { where(document_type: type) }
  scope :by_folder, ->(folder) { where(folder: folder) }
  scope :by_source, ->(source) { where(source: source) }
  scope :by_asset, ->(asset_id) { where(asset_id: asset_id) }
  scope :with_asset, -> { where.not(asset_id: nil) }
  scope :without_asset, -> { where(asset_id: nil) }
  scope :electronic, -> { where(storage_type: "electronic") }
  scope :manual, -> { where(storage_type: "manual") }
  scope :recent, -> { order(created_at: :desc) }
  scope :by_financial_year, ->(year) { where("financial_years @> ARRAY[?]::integer[]", year.to_i) }
  scope :by_content_hash, ->(hash) { where(content_hash: hash) if hash.present? }

  # Callbacks
  after_create :create_activity
  before_save :extract_financial_years_from_title
  before_save :generate_display_title

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
    return CompanyDocument.none if content_hash.blank?
    CompanyDocument.by_content_hash(content_hash).where.not(id: id)
  end

  def has_duplicates?
    find_duplicates.exists?
  end

  private

  def create_activity
    return unless company.present?

    performer = Current.user if defined?(Current) && Current.respond_to?(:user)
    performer ||= User.first

    company.company_activities.create!(
      activity_type: "document_uploaded",
      description: "Document uploaded: #{title}",
      change_details: {
        document_type: document_type,
        file_name: file_name,
        file_size: file_size
      },
      user: performer
    )
  end

  # Generate a user-friendly display title from the abbreviated filename
  def generate_display_title
    return if title.blank?
    return if !title_changed? && display_title.present?

    display = title.dup

    # Remove company code prefix (e.g., "TD ", "THFT ")
    if company&.code.present?
      display = display.sub(/\A#{Regexp.escape(company.code)}\s+/i, "")
    end

    # Expand FY to full year (FY21 → 2021, FY2021 → 2021)
    display = display.gsub(/\bFY(\d{2})\b/) { "20#{$1}" }
    display = display.gsub(/\bFY(\d{4})\b/) { $1 }

    # Expand S/US to Signed/Unsigned BEFORE expanding CTR/TTR
    display = display.gsub(/\bUS\s+CTR\b/i, "Unsigned CTR")
    display = display.gsub(/\bS\s+CTR\b/i, "Signed CTR")
    display = display.gsub(/\bUS\s+TTR\b/i, "Unsigned TTR")
    display = display.gsub(/\bS\s+TTR\b/i, "Signed TTR")

    # Expand document type abbreviations from database
    CorporateCompanyDocument.document_type_abbreviations.each do |abbr, full|
      display = display.gsub(/\b#{Regexp.escape(abbr)}\b/, full)
    end

    # Titleize DRAFT/AMENDED
    display = display.gsub(/\bDRAFT\b/i, "Draft")
    display = display.gsub(/\bAMENDED\b/i, "Amended")

    # Remove file extension
    display = display.sub(/\.(pdf|docx?|xlsx?|png|jpg|jpeg)$/i, "")

    # Clean up extra spaces
    display = display.gsub(/\s+/, " ").strip

    self.display_title = display
  end

  # Extract financial years from title
  def extract_financial_years_from_title
    return if title.blank?

    unless title.match?(/FY\d{2,4}/i)
      self.financial_years = []
      return
    end

    years = Set.new

    title.scan(/FY(\d{2,4})/i).each do |match|
      year_str = match[0]
      year = year_str.length == 2 ? "20#{year_str}".to_i : year_str.to_i
      years.add(year) if year >= 2000 && year <= 2100
    end

    self.financial_years = years.to_a.sort
  end
end
