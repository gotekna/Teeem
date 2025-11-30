class CompanyDocument < ApplicationRecord
  # Associations
  belongs_to :company, optional: true
  belongs_to :contact, optional: true  # For documents linked to people (family members, directors)
  belongs_to :user, optional: true
  belongs_to :asset, optional: true
  belongs_to :loan, class_name: 'CompanyLoan', optional: true
  belongs_to :document_type_record, class_name: 'DocumentType', foreign_key: 'document_type_id', optional: true

  # Active Storage for file upload
  has_one_attached :file

  # Storage types for Company Register tracking
  STORAGE_TYPES = %w[manual electronic both].freeze

  # Validations
  validates :title, presence: true
  validates :document_type, inclusion: {
    in: %w[constitution minutes loan_agreement security_deed setup share_certificate
           tax_return financial_statement insurance_policy asic share_registry trust_deed
           financial tax insurance contract certificate other]
  }, allow_blank: true
  validates :storage_type, inclusion: { in: STORAGE_TYPES }, allow_blank: true

  # Validations for ownership
  validate :must_have_owner

  # Scopes
  scope :for_company, ->(company_id) { where(company_id: company_id) }
  scope :for_contact, ->(contact_id) { where(contact_id: contact_id) }
  scope :by_type, ->(type) { where(document_type: type) }
  scope :by_year, ->(year) { where(year: year) }
  scope :by_folder, ->(folder) { where(folder: folder) }
  scope :by_tab, ->(tab) {
    # Match documents either by:
    # 1. folder field matching the tab name (SharePoint synced documents)
    # 2. document_type matching a DocumentType whose tabs array contains this tab
    joins("LEFT JOIN document_types ON document_types.name = company_documents.document_type")
      .where("UPPER(company_documents.folder) = ? OR document_types.tabs @> ?", tab.upcase, [tab].to_json)
  }
  scope :by_source, ->(source) { where(source: source) }
  scope :by_asset, ->(asset_id) { where(asset_id: asset_id) }
  scope :with_asset, -> { where.not(asset_id: nil) }
  scope :without_asset, -> { where(asset_id: nil) }
  scope :electronic, -> { where(storage_type: 'electronic') }
  scope :manual, -> { where(storage_type: 'manual') }
  scope :recent, -> { order(created_at: :desc) }
  # Filter by financial year using PostgreSQL array contains
  scope :by_financial_year, ->(year) { where("financial_years @> ARRAY[?]::integer[]", year.to_i) }

  # Callbacks
  after_create :create_activity
  before_save :extract_financial_years_from_title

  # Instance methods
  def formatted_document_type
    document_type.to_s.titleize.gsub('_', ' ')
  end

  def file_size_mb
    return nil unless file_size.present?
    (file_size.to_f / 1024 / 1024).round(2)
  end

  def display_name
    title
  end

  private

  def create_activity
    # Only create activity if there's a company (contacts don't have company_activities)
    return unless company.present?

    performer = user || (defined?(Current) && Current.respond_to?(:user) ? Current.user : nil) || User.first
    company.company_activities.create!(
      activity_type: 'document_uploaded',
      description: "Document uploaded: #{title}",
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

  # Extract financial years from title
  # Patterns supported:
  # - FY21, FY2021 -> 2021
  # - 2021 Tax Return -> 2021
  # - Date ranges like "1/6/2021 - 15/7/2021" -> [2021, 2022] (crosses FY boundary)
  def extract_financial_years_from_title
    return if title.blank?

    years = Set.new

    # Pattern 1: FY followed by 2 or 4 digits (e.g., FY21, FY2021)
    title.scan(/FY(\d{2,4})/i).each do |match|
      year_str = match[0]
      year = year_str.length == 2 ? "20#{year_str}".to_i : year_str.to_i
      years.add(year) if year >= 2000 && year <= 2100
    end

    # Pattern 2: Standalone 4-digit years (e.g., 2021, 2022)
    # Only if FY wasn't found - avoid double-counting
    if years.empty?
      title.scan(/\b(20\d{2})\b/).each do |match|
        years.add(match[0].to_i)
      end
    end

    # Pattern 3: Date ranges (e.g., "1/6/2021 - 15/7/2021" or "01-Jun-2021 to 15-Jul-2021")
    # Extract dates and calculate which financial years they span
    date_pattern = /(\d{1,2})[\/\-](\d{1,2}|\w{3})[\/\-](\d{2,4})/
    dates = title.scan(date_pattern)
    if dates.length >= 2
      # Parse start and end dates to determine FY span
      dates.each do |match|
        day, month, year_str = match
        year = year_str.length == 2 ? "20#{year_str}".to_i : year_str.to_i

        # Parse month (handle both numeric and text)
        month_num = case month.downcase
                    when 'jan', '01', '1' then 1
                    when 'feb', '02', '2' then 2
                    when 'mar', '03', '3' then 3
                    when 'apr', '04', '4' then 4
                    when 'may', '05', '5' then 5
                    when 'jun', '06', '6' then 6
                    when 'jul', '07', '7' then 7
                    when 'aug', '08', '8' then 8
                    when 'sep', '09', '9' then 9
                    when 'oct', '10' then 10
                    when 'nov', '11' then 11
                    when 'dec', '12' then 12
                    else month.to_i
                    end

        # Australian FY: July 1 - June 30
        # FY2021 = July 1 2020 to June 30 2021
        # So dates in Jan-Jun belong to the FY of that year
        # Dates in Jul-Dec belong to the FY of next year
        fy = month_num >= 7 ? year + 1 : year
        years.add(fy) if fy >= 2000 && fy <= 2100
      end
    end

    self.financial_years = years.to_a.sort
  end

  # Class method to update financial years for all existing documents
  def self.backfill_financial_years!
    CompanyDocument.find_each do |doc|
      doc.extract_financial_years_from_title
      doc.save(validate: false) if doc.financial_years_changed?
    end
  end
end
