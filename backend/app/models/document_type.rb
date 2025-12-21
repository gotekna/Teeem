class DocumentType < ApplicationRecord
  # Associations
  has_many :corporate_company_documents, dependent: :nullify
  has_many :job_documents, dependent: :nullify
  has_many :document_type_folders, dependent: :destroy
  has_many :folders, through: :document_type_folders, source: :document_folder

  # Get folder names for display (backwards compatible with old tabs array)
  def folder_names
    folders.pluck(:name)
  end

  # Get the primary folder
  def primary_folder
    document_type_folders.find_by(is_primary: true)&.document_folder
  end

  # Set folders by IDs (replaces existing assignments)
  def folder_ids=(ids)
    ids = Array(ids).map(&:to_i).reject(&:zero?)
    existing_ids = document_type_folders.pluck(:document_folder_id)

    # Remove old assignments
    document_type_folders.where.not(document_folder_id: ids).destroy_all

    # Add new assignments
    (ids - existing_ids).each do |folder_id|
      document_type_folders.create(document_folder_id: folder_id)
    end
  end

  # Get folder IDs
  def folder_ids
    document_type_folders.pluck(:document_folder_id)
  end

  # Callbacks - clear CorporateCompanyDocument abbreviation cache when document types change
  after_save :clear_abbreviation_cache
  after_destroy :clear_abbreviation_cache
  # ULTRA SSoT: When display_name changes, regenerate all linked documents' display_titles
  after_save :regenerate_document_display_titles, if: :saved_change_to_display_name?

  # Validations
  validates :name, presence: true, uniqueness: true
  validates :category, inclusion: { in: %w[corporate tax compliance general financial company trust advice registry insurance asic ato bank assets dividends loans minutes people], allow_blank: true }

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
    doc_type = active.find_by("LOWER(name) = ?", normalized_term)
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
        doc_type = active.find_by("LOWER(name) = ?", canonical_name.downcase)
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
    ([ name ] + db_aliases + default_aliases).uniq
  end

  # Group document types by folder
  def self.grouped_by_folder
    active.order(:folder, :name).group_by(&:folder)
  end

  # Generate a preview title showing what the document will look like when named
  # Replaces placeholders with example values, date in AU format (DD-MM-YYYY)
  def title_preview
    return nil if file_name.blank?

    # Australian date format (DD-MM-YYYY)
    au_date = Date.current.strftime("%d-%m-%Y")

    format = file_name.dup

    # Replace all placeholders with example values
    # Corporate placeholders
    format.gsub!("{CompanyCode}", abbreviation.presence || "ABC")
    format.gsub!("{CompanyName}", "ABC Property Trust")
    format.gsub!("{CompanyGroup}", "Tekna Group")
    format.gsub!("{LoanID}", "L001")
    format.gsub!("{LenderCode}", "NAB")
    format.gsub!("{AssetCode}", "PROP1")
    format.gsub!("{FY}", "FY25")
    format.gsub!("{YY}", "25")
    format.gsub!("{Period}", "Q1 Jul-Sep")
    format.gsub!("{PrintDate}", au_date)
    format.gsub!("{Signed}", "")
    format.gsub!("{BankCode}", "NAB")
    format.gsub!("{BSB}", "082-123")
    format.gsub!("{AccountNum}", "12345")

    # Job placeholders
    format.gsub!("{JobCode}", "J069")
    format.gsub!("{JobTitle}", "83 West Ridge")
    format.gsub!("{CertType}", "Occupancy")
    format.gsub!("{Consultant}", "ABC Eng")
    format.gsub!("{Number}", "01")
    format.gsub!("{Category}", category.presence || "General")

    # People placeholders
    format.gsub!("{PersonName}", "Andrew Clememt")
    format.gsub!("{IDType}", "Passport")

    # Common placeholders
    format.gsub!("{Description}", "Example")
    format.gsub!("{Date}", au_date)
    format.gsub!("{Folder}", folder.presence || "GENERAL")

    format.strip
  end

  # Generate proposed filename for a specific job
  # Uses actual job data instead of placeholder values
  def generate_proposed_name(job:, file_extension: nil, description: nil, number: nil)
    return nil if file_name.blank?

    # Australian date format (DD-MM-YYYY)
    au_date = Date.current.strftime("%d-%m-%Y")

    format = file_name.dup

    # Job placeholders with actual data
    job_code = "J#{job.id.to_s.rjust(3, '0')}"
    job_title = job.title.to_s.split(",").first.to_s.strip.gsub(/[^\w\s-]/, "").strip[0..30] # First part of address, sanitized

    format.gsub!("{JobCode}", job_code)
    format.gsub!("{JobTitle}", job_title)
    format.gsub!("{CertType}", description.presence || "Cert")
    format.gsub!("{Consultant}", description.presence || "Consultant")
    format.gsub!("{Number}", number.to_s.rjust(2, "0"))
    format.gsub!("{Category}", category.presence || "General")

    # Corporate placeholders (use abbreviation or defaults)
    format.gsub!("{CompanyCode}", abbreviation.presence || "ABC")
    format.gsub!("{CompanyName}", "ABC Property Trust")
    format.gsub!("{CompanyGroup}", "Tekna Group")
    format.gsub!("{LoanID}", "L001")
    format.gsub!("{LenderCode}", "NAB")
    format.gsub!("{AssetCode}", "PROP1")
    fy_year = Date.current.month >= 7 ? (Date.current.year + 1).to_s[-2..] : Date.current.year.to_s[-2..]
    format.gsub!("{FY}", "FY#{fy_year}")
    format.gsub!("{YY}", fy_year)
    format.gsub!("{Period}", "Q1 Jul-Sep")
    format.gsub!("{PrintDate}", au_date)
    format.gsub!("{Signed}", "")
    format.gsub!("{BankCode}", "NAB")
    format.gsub!("{BSB}", "082-123")
    format.gsub!("{AccountNum}", "12345")

    # Common placeholders
    format.gsub!("{Description}", description.presence || name.to_s.split(" - ").last.to_s)
    format.gsub!("{Date}", au_date)
    format.gsub!("{Folder}", folder.presence || "GENERAL")

    result = format.strip

    # Add file extension if provided
    result += ".#{file_extension}" if file_extension.present?

    result
  end

  private

  # Clear the CorporateCompanyDocument abbreviation cache when document types are updated
  def clear_abbreviation_cache
    CorporateCompanyDocument.clear_abbreviations_cache!
  end

  # ULTRA SSoT: Regenerate display_titles for all linked documents when display_name changes
  def regenerate_document_display_titles
    return unless display_name.present?

    # Queue a background job to avoid blocking the save
    RegenerateDisplayTitlesJob.perform_later(id) if defined?(RegenerateDisplayTitlesJob)

    # For now, also do inline update for immediate effect (small batches)
    corporate_company_documents.find_each(batch_size: 100) do |doc|
      new_title = doc.expand_display_template(display_name)
      doc.update_column(:display_title, new_title) if new_title != doc.display_title
    end
  end
end
