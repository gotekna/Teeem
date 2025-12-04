class DocumentType < ApplicationRecord
  # Associations
  has_many :company_documents, dependent: :nullify
  has_many :job_documents, dependent: :nullify

  # Validations
  validates :name, presence: true, uniqueness: true
  validates :category, inclusion: { in: %w[corporate tax compliance general financial company trust advice registry insurance asic ato bank assets dividends loans minutes], allow_blank: true }

  # Scopes
  scope :active, -> { where(active: true) }
  scope :by_folder, ->(folder) { where(folder: folder) }
  scope :by_category, ->(category) { where(category: category) }
  scope :by_scope, ->(scope_name) { where(scope: scope_name) }
  scope :for_company, -> { where(scope: %w[company both]) }
  scope :for_job, -> { where(scope: %w[job both]) }
  scope :requiring_filing, -> { where(requires_filing: true) }

  # Default aliases for common document types - maps alternative names to canonical names
  # These are used as fallback when database aliases aren't set
  # Key = canonical name (must match a DocumentType.name in database)
  # Value = array of alternative names/aliases
  DEFAULT_ALIASES = {
    # ATO Documents
    "BAS - Business Activity Statement" => [
      "Activity Statement", "AS", "Business Activity Statement", "BAS",
      "Activity Stmt", "Bus Activity Statement"
    ],
    "CTR - Company Tax Return" => [
      "Income Tax", "Income Tax Return", "CT", "CTR", "Tax Return",
      "Corporate Tax Return", "Company Tax", "Company Tax Return"
    ],
    "TTR - Trust Tax Return" => [
      "TTR", "Trust Tax", "Trust Income Tax", "Trust Tax Return"
    ],
    "IAS - Instalment Activity Statement" => [
      "Instalment Activity Statement", "IAS", "Instalment Statement"
    ],
    "ATO Documents" => [
      "ATO Document", "ATO Correspondence", "ATO Letter", "ATO Notice",
      "ato_document", "ato document"
    ],

    # Financial
    "Financial Statements" => [
      "Financial Statement", "FS", "Financials", "Annual Financials",
      "Year End Financials", "Final Financials"
    ],
    "Annual Report" => [
      "AR", "Yearly Report"
    ],

    # ASIC
    "Annual Statement" => [
      "ASIC Annual Statement", "Company Statement"
    ],
    "Company Extract" => [
      "CE", "ASIC Extract", "Current Company Extract"
    ],

    # Company
    "Constitution" => [
      "Company Constitution", "CON"
    ],
    "Minutes" => [
      "Meeting Minutes", "MIN", "Board Minutes", "Directors Minutes"
    ],
    "Resolution" => [
      "RES", "Directors Resolution", "Members Resolution"
    ],

    # Trust
    "Trust Deed" => [
      "TD", "Deed of Trust"
    ],

    # Loans
    "Loan Agreement" => [
      "LA", "Loan Contract", "Facility Agreement"
    ],
    "Security Deed" => [
      "SD", "Deed of Security"
    ],
    "PPSR Registration" => [
      "PPSR", "Personal Property Security"
    ],

    # Bank
    "Bank Statement" => [
      "BS", "Account Statement", "Statement of Account"
    ],

    # Insurance
    "Certificate of Currency" => [
      "COC", "Insurance Certificate", "Currency Certificate"
    ]
  }.freeze

  # Returns the preferred display name (uses display_name column if set, otherwise name)
  def canonical_display_name
    read_attribute(:display_name).presence || name
  end

  # Find a document type by name OR any of its aliases (database or default)
  # Returns the canonical document type that matches
  def self.find_by_name_or_alias(term)
    return nil if term.blank?

    normalized_term = term.to_s.strip.downcase

    # First try exact name match
    doc_type = active.find_by('LOWER(name) = ?', normalized_term)
    return doc_type if doc_type

    # Then try database alias match (aliases is a JSONB array)
    active.find_each do |dt|
      if dt.aliases.is_a?(Array) && dt.aliases.any?
        if dt.aliases.any? { |a| a.to_s.strip.downcase == normalized_term }
          return dt
        end
      end
    end

    # Finally try default aliases
    DEFAULT_ALIASES.each do |canonical_name, aliases|
      if aliases.any? { |a| a.to_s.strip.downcase == normalized_term }
        # Found in defaults, look up the canonical document type
        doc_type = active.find_by('LOWER(name) = ?', canonical_name.downcase)
        return doc_type if doc_type
      end
    end

    nil
  end

  # Normalize any term (name or alias) to the canonical document type name
  def self.normalize_to_canonical(term)
    doc_type = find_by_name_or_alias(term)
    doc_type&.name
  end

  # Get all terms that map to this document type (name + database aliases + default aliases)
  def all_terms
    db_aliases = aliases.is_a?(Array) ? aliases : []
    default_aliases = DEFAULT_ALIASES[name] || []
    ([name] + db_aliases + default_aliases).uniq
  end

  # Group document types by folder
  def self.grouped_by_folder
    active.order(:folder, :name).group_by(&:folder)
  end

  # Generate a preview title showing what the document will look like when named
  # Replaces placeholders with example values, date in AU format (DD-MM-YYYY)
  def title_preview
    return nil if naming_format.blank?

    # Australian date format (DD-MM-YYYY)
    au_date = Date.current.strftime('%d-%m-%Y')

    format = naming_format.dup

    # Replace all placeholders with example values
    # Corporate placeholders
    format.gsub!('{CompanyCode}', abbreviation.presence || 'DOC')
    format.gsub!('{LoanID}', 'L001')
    format.gsub!('{LenderCode}', 'NAB')
    format.gsub!('{AssetCode}', 'PROP1')
    format.gsub!('{FY}', '2025')
    format.gsub!('{YY}', '25')
    format.gsub!('{Period}', 'Q1')
    format.gsub!('{PrintDate}', au_date)
    format.gsub!('{Signed}', '')

    # Job placeholders
    format.gsub!('{JobCode}', 'J069')
    format.gsub!('{JobTitle}', '83 West Ridge')
    format.gsub!('{CertType}', 'Occupancy')
    format.gsub!('{Consultant}', 'ABC Eng')
    format.gsub!('{Number}', '01')

    # Common placeholders - use document type name for description
    format.gsub!('{Description}', '{Description}')
    format.gsub!('{Date}', au_date)

    format.strip
  end

  # Generate proposed filename for a specific job
  # Uses actual job data instead of placeholder values
  def generate_proposed_name(job:, file_extension: nil, description: nil, number: nil)
    return nil if naming_format.blank?

    # Australian date format (DD-MM-YYYY)
    au_date = Date.current.strftime('%d-%m-%Y')

    format = naming_format.dup

    # Job placeholders with actual data
    job_code = "J#{job.id.to_s.rjust(3, '0')}"
    job_title = job.title.to_s.split(',').first.to_s.strip.gsub(/[^\w\s-]/, '').strip[0..30] # First part of address, sanitized

    format.gsub!('{JobCode}', job_code)
    format.gsub!('{JobTitle}', job_title)
    format.gsub!('{CertType}', description.presence || 'Cert')
    format.gsub!('{Consultant}', description.presence || 'Consultant')
    format.gsub!('{Number}', number.to_s.rjust(2, '0'))

    # Corporate placeholders (use abbreviation or defaults)
    format.gsub!('{CompanyCode}', abbreviation.presence || 'DOC')
    format.gsub!('{LoanID}', 'L001')
    format.gsub!('{LenderCode}', 'NAB')
    format.gsub!('{AssetCode}', 'PROP1')
    format.gsub!('{FY}', Date.current.month >= 7 ? (Date.current.year + 1).to_s : Date.current.year.to_s)
    format.gsub!('{YY}', Date.current.month >= 7 ? (Date.current.year + 1).to_s[-2..] : Date.current.year.to_s[-2..])
    format.gsub!('{Period}', 'Q1')
    format.gsub!('{PrintDate}', au_date)
    format.gsub!('{Signed}', '')

    # Common placeholders
    format.gsub!('{Description}', description.presence || name.to_s.split(' - ').last.to_s)
    format.gsub!('{Date}', au_date)

    result = format.strip

    # Add file extension if provided
    result += ".#{file_extension}" if file_extension.present?

    result
  end
end
