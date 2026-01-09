class CorporateCompanyDocument < ApplicationRecord
  include DocumentTemplatable
  include Searchable

  # Searchable columns for full-text search (GIN index)
  searchable_columns :file_name, :display_name, :description, :folder

  # Associations
  belongs_to :corporate_company, foreign_key: "company_id", optional: true

  # Alias for as_json compatibility (alias_method works for associations, alias_attribute doesn't)
  def company
    corporate_company
  end
  belongs_to :contact, optional: true  # For documents linked to people (family members, directors)
  belongs_to :user, optional: true
  belongs_to :asset, optional: true
  belongs_to :loan, class_name: "CorporateCompanyLoan", optional: true
  belongs_to :document_type_record, class_name: "DocumentType", foreign_key: "document_type_id", optional: true
  belongs_to :user_validated_by, class_name: "User", optional: true

  # Polymorphic association - link to PurchaseOrder, ExternalInvoice, Job, etc.
  belongs_to :documentable, polymorphic: true, optional: true

  # Activity log for tracking changes
  # Note: foreign_key is :company_document_id (legacy name from before table rename)
  has_many :document_activities, foreign_key: :company_document_id, dependent: :destroy

  # Case links
  # Note: foreign_key is :company_document_id (legacy name from before table rename)
  has_many :case_documents, foreign_key: :company_document_id, dependent: :destroy
  has_many :cases, through: :case_documents, source: :case_record

  # Verification feedback
  # Note: foreign_key is :company_document_id (legacy name from before table rename)
  has_many :document_verification_feedbacks, foreign_key: :company_document_id, dependent: :destroy

  # Duplicate tracking
  has_many :duplicate_reviews_as_existing, class_name: "DocumentDuplicateReview", foreign_key: :existing_document_id, dependent: :destroy
  has_many :duplicate_reviews_as_new, class_name: "DocumentDuplicateReview", foreign_key: :new_document_id, dependent: :nullify

  # Task attachments
  has_many :sm_task_attachments, as: :attachable, dependent: :destroy
  has_many :attached_tasks, through: :sm_task_attachments, source: :sm_task

  # Active Storage for file upload
  has_one_attached :file

  # File upload validation (security: prevents storage DoS and malware upload)
  ALLOWED_CONTENT_TYPES = %w[
    application/pdf
    image/jpeg image/png image/tiff image/heic
    application/vnd.openxmlformats-officedocument.wordprocessingml.document
    application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
    application/vnd.ms-excel application/msword
    text/plain text/csv
  ].freeze

  validates :file, content_type: ALLOWED_CONTENT_TYPES,
                   size: { less_than: 50.megabytes, message: "must be less than 50MB" }

  # Storage types for Company Register tracking
  STORAGE_TYPES = %w[manual electronic both].freeze

  # AI verification statuses
  AI_VERIFICATION_STATUSES = %w[pending verified mismatch needs_review].freeze

  # Focus types - three main categories for organizing documents
  FOCUS_TYPES = %w[company people job].freeze

  # Legacy hardcoded document types for backward compatibility
  LEGACY_DOCUMENT_TYPES = %w[constitution minutes loan_agreement security_deed setup share_certificate
                             tax_return financial_statement insurance_policy asic share_registry trust_deed
                             financial tax insurance contract certificate invoice quote other].freeze

  # Returns all allowed document types (from database + legacy hardcoded)
  def self.allowed_document_types
    # Get document type names from database
    db_types = DocumentType.pluck(:name) rescue []
    # Combine with legacy types
    (LEGACY_DOCUMENT_TYPES + db_types).uniq
  end

  # Legacy abbreviations for fallback (when DB is unavailable)
  LEGACY_ABBREVIATIONS = {
    "CTR" => "Company Tax Return",
    "TTR" => "Trust Tax Return",
    "BAS" => "Business Activity Statement",
    "PPSR" => "PPSR Registration",
    "CA" => "Client Advice",
    "AA" => "Accountant Advice",
    "LA" => "Legal Advice"
  }.freeze

  # Document type abbreviations for display title generation
  # Reads from database with caching, falls back to legacy if DB unavailable
  def self.document_type_abbreviations
    @abbreviations_cache ||= begin
      # Build hash from database: abbreviation => display_name (or name if no display_name)
      db_abbrs = DocumentType.where.not(abbreviation: [ nil, "" ])
                             .pluck(:abbreviation, :display_name, :name)
                             .each_with_object({}) do |(abbr, display_name, name), hash|
        # Use display_name if set, otherwise extract display name from name
        # e.g., "CTR - Company Tax Return" -> "Company Tax Return"
        display = display_name.presence || name.to_s.sub(/\A\w+\s*-\s*/, "")
        hash[abbr] = display
      end
      # Merge with legacy fallback (DB takes precedence)
      LEGACY_ABBREVIATIONS.merge(db_abbrs)
    rescue => e
      Rails.logger.warn "[CorporateCompanyDocument] Failed to load abbreviations from DB: #{e.message}"
      LEGACY_ABBREVIATIONS
    end
  end

  # Clear the abbreviations cache (called when DocumentType changes)
  def self.clear_abbreviations_cache!
    @abbreviations_cache = nil
  end

  # Validations
  validates :file_name, presence: true  # SSoT: file_name is THE filename
  # Allow document_type from the DocumentType table or legacy hardcoded values
  validates :document_type, inclusion: {
    in: ->(doc) { doc.class.allowed_document_types }
  }, allow_blank: true
  validates :storage_type, inclusion: { in: STORAGE_TYPES }, allow_blank: true
  validates :focus, inclusion: { in: FOCUS_TYPES }, presence: true

  # Validations for ownership
  validate :must_have_owner

  # Scopes
  scope :for_company, ->(company_id) { where(company_id: company_id) }
  scope :for_contact, ->(contact_id) { where(contact_id: contact_id) }
  scope :by_type, ->(type) { where(document_type: type) }
  scope :by_year, ->(year) { where(year: year) }
  scope :by_folder, ->(folder) { where(folder: folder) }
  scope :by_tab, ->(tab) {
    # Match documents by any of:
    # 1. folder field matching the tab name (SharePoint synced documents)
    # 2. document_type (string) matching a DocumentType whose tabs array contains this tab (legacy)
    # 3. document_type_id (FK) matching a DocumentType whose tabs array contains this tab (SSoT)
    joins("LEFT JOIN document_types dt_legacy ON dt_legacy.name = corporate_company_documents.document_type")
      .joins("LEFT JOIN document_types dt_fk ON dt_fk.id = corporate_company_documents.document_type_id")
      .where(
        "UPPER(corporate_company_documents.folder) = ? OR dt_legacy.tabs @> ? OR dt_fk.tabs @> ?",
        tab.upcase, [ tab ].to_json, [ tab ].to_json
      )
  }
  scope :by_source, ->(source) { where(source: source) }
  scope :by_asset, ->(asset_id) { where(asset_id: asset_id) }
  scope :with_asset, -> { where.not(asset_id: nil) }
  scope :without_asset, -> { where(asset_id: nil) }
  scope :electronic, -> { where(storage_type: "electronic") }
  scope :manual, -> { where(storage_type: "manual") }
  scope :recent, -> { order(created_at: :desc) }
  # Filter by financial year using PostgreSQL array contains
  scope :by_financial_year, ->(year) { where("financial_years @> ARRAY[?]::integer[]", year.to_i) }
  scope :by_content_hash, ->(hash) { where(content_hash: hash) if hash.present? }
  # Filter by focus (company, people, job)
  scope :by_focus, ->(focus) { where(focus: focus) if focus.present? }
  scope :company_focus, -> { where(focus: "company") }
  scope :people_focus, -> { where(focus: "people") }
  scope :job_focus, -> { where(focus: "job") }

  # Callbacks
  after_create :create_activity
  before_validation :set_focus
  before_save :extract_financial_years_from_file_name  # SSoT: file_name is THE filename
  before_save :generate_display_name                    # SSoT: display_name is THE display

  # Instance methods
  def formatted_document_type
    document_type.to_s.titleize.gsub("_", " ")
  end

  def file_size_mb
    return nil unless file_size.present?
    (file_size.to_f / 1024 / 1024).round(2)
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
    return CorporateCompanyDocument.none if content_hash.blank?
    CorporateCompanyDocument.by_content_hash(content_hash).where.not(id: id)
  end

  def has_duplicates?
    find_duplicates.exists?
  end

  private

  # Automatically set focus based on associations
  # Priority: people > job > company
  def set_focus
    self.focus = if contact_id.present?
                   "people"
    elsif job_id.present? || documentable_type&.include?("Job")
                   "job"
    else
                   "company"
    end
  end

  def create_activity
    # Only create activity if there's a company (contacts don't have company_activities)
    return unless corporate_company.present?

    performer = user || (defined?(Current) && Current.respond_to?(:user) ? Current.user : nil) || User.first
    corporate_company.company_activities.create!(
      activity_type: "document_uploaded",
      description: "Document uploaded: #{file_name}",
      change_details: {
        document_type: document_type,
        file_name: file_name,
        file_size: file_size
      },
      user: performer
    )
  end

  def must_have_owner
    if company_id.blank? && contact_id.blank?
      errors.add(:base, "Document must belong to a company or contact")
    end
  end

  # Generate a user-friendly display name from the filename
  # ULTRA SSoT: DocumentType.display_name IS the template
  # If document has a type, use its template. Otherwise, clean the filename.
  def generate_display_name
    return if file_name.blank?
    # Only regenerate if relevant fields changed or display_name is blank
    return if display_name.present? && !file_name_changed? && !document_type_id_changed?

    if document_type_record&.display_name.present?
      self.display_name = expand_display_template(document_type_record.display_name)
    else
      self.display_name = clean_file_name_for_display
    end
  end

  # Provide context for DocumentTemplatable concern
  # SSoT: All template expansion uses the concern's expand_display_template method
  def template_context
    fy = financial_years&.first || extract_fy_from_file_name
    {
      company_code: corporate_company&.code,
      company_name: corporate_company&.name,
      doc_type_name: document_type_record&.name,
      doc_type_code: document_type_record&.abbreviation,
      financial_year: fy,
      financial_years: financial_years,
      document_date: document_date,
      file_name: file_name
    }
  end

  # Extract FY from file_name if not in financial_years
  def extract_fy_from_file_name
    return nil unless file_name.present?
    if file_name.match?(/FY(\d{2})\b/)
      "20#{file_name.match(/FY(\d{2})\b/)[1]}".to_i
    elsif file_name.match?(/FY(\d{4})\b/)
      file_name.match(/FY(\d{4})\b/)[1].to_i
    end
  end

  # Fallback: clean filename for display when no DocumentType
  def clean_file_name_for_display
    display = file_name.dup

    # Remove company code prefix if present
    if corporate_company&.code.present?
      display.sub!(/\A#{Regexp.escape(corporate_company.code)}\s+/i, '')
    end

    # Remove file extension
    display.sub!(/\.(pdf|docx?|xlsx?|png|jpg|jpeg)$/i, '')

    # Clean up extra spaces
    display.gsub!(/\s+/, ' ')
    display.strip
  end

  # Extract financial years from file_name
  # ONLY extracts if file_name explicitly contains "FY" pattern
  # If file_name uses dates or date ranges without FY, financial_years is cleared
  def extract_financial_years_from_file_name
    return if file_name.blank?

    # Only populate financial_years if file_name explicitly contains "FY" pattern
    # Documents with date ranges (e.g., "BAS Statement 01-07-2023 to 30-06-2024") should NOT have FY
    unless file_name.match?(/FY\d{2,4}/i)
      self.financial_years = []
      return
    end

    years = Set.new

    # Extract FY followed by 2 or 4 digits (e.g., FY21, FY2021)
    file_name.scan(/FY(\d{2,4})/i).each do |match|
      year_str = match[0]
      year = year_str.length == 2 ? "20#{year_str}".to_i : year_str.to_i
      years.add(year) if year >= 2000 && year <= 2100
    end

    self.financial_years = years.to_a.sort
  end

  # Class method to update financial years for all existing documents
  def self.backfill_financial_years!
    CorporateCompanyDocument.find_each do |doc|
      doc.extract_financial_years_from_file_name
      doc.save(validate: false) if doc.financial_years_changed?
    end
  end

  # Class method to generate display_name for all existing documents
  def self.backfill_display_names!
    count = 0
    CorporateCompanyDocument.includes(:corporate_company).find_each do |doc|
      doc.send(:generate_display_name)
      if doc.display_name_changed?
        doc.save(validate: false)
        count += 1
      end
    end
    Rails.logger.info "[CorporateCompanyDocument] Updated #{count} documents with display names"
    count
  end
end
