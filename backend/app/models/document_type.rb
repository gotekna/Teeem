class DocumentType < ApplicationRecord
  # Associations
  has_many :corporate_company_documents, dependent: :nullify
  has_many :job_documents, dependent: :nullify

  # SSoT: EntityTab associations
  has_many :entity_tab_document_types, dependent: :destroy
  has_many :entity_tabs, through: :entity_tab_document_types

  # Get tab names for display (SSoT: uses EntityTabs)
  def tab_names
    entity_tabs.pluck(:display_name)
  end

  # Get the primary tab (first linked tab or first by position)
  def primary_entity_tab
    entity_tabs.ordered.first
  end

  # Set tabs by EntityTab IDs (SSoT: replaces old folder_ids=)
  def entity_tab_ids=(ids)
    ids = Array(ids).map(&:to_i).reject(&:zero?)

    # For new records, store the IDs and create associations after save
    if new_record?
      @pending_entity_tab_ids = ids
    else
      sync_entity_tab_ids(ids)
    end
  end

  # Backwards compatibility: folder_ids now maps to entity_tab_ids
  alias_method :folder_ids=, :entity_tab_ids=
  alias_method :folder_ids, :entity_tab_ids

  # Get EntityTab IDs
  def entity_tab_ids
    entity_tab_document_types.pluck(:entity_tab_id)
  end

  # Sync entity_tab_ids with the database
  def sync_entity_tab_ids(ids)
    existing_ids = entity_tab_document_types.pluck(:entity_tab_id)

    # Remove old assignments
    entity_tab_document_types.where.not(entity_tab_id: ids).destroy_all

    # Add new assignments
    (ids - existing_ids).each do |tab_id|
      entity_tab_document_types.create(entity_tab_id: tab_id)
    end
  end

  # Callbacks - clear CorporateCompanyDocument abbreviation cache when document types change
  after_save :clear_abbreviation_cache
  after_destroy :clear_abbreviation_cache
  # ULTRA SSoT: When display_name template changes, regenerate all linked documents' display_names
  after_save :regenerate_document_display_names, if: :saved_change_to_display_name?
  # Sync pending entity_tab_ids after create (deferred from entity_tab_ids= setter)
  after_create :sync_pending_entity_tab_ids
  # Track naming format changes for standardization prompts
  after_save :track_naming_format_change, if: :saved_change_to_file_name?

  # Attribute to track naming format change details (used by API response)
  attr_accessor :naming_format_change_info

  # Validations
  # Name must be unique within each scope (company, job, people, both)
  # This allows the same name in different scopes (e.g., "Invoice" for both company and job)
  validates :name, presence: true, uniqueness: { scope: :scope, message: "has already been taken for this scope" }
  # Note: category field is deprecated - tabs/folders (EntityTab) are now the primary organization method

  # Scopes
  scope :active, -> { where(active: true) }
  scope :by_folder, ->(folder) { where(folder: folder) }
  scope :by_category, ->(category) { where(category: category) }
  scope :by_scope, ->(scope_name) { where(scope: scope_name) }
  scope :for_company, -> { where(scope: %w[company both]) }
  scope :for_job, -> { where(scope: %w[job both]) }
  # SSoT: "contacts" is the canonical scope, "people" is legacy - include both for backwards compatibility
  scope :for_contacts, -> { where(scope: %w[contacts people]) }
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

    # Tab/folder placeholders
    format.gsub!("{TabCode}", "Site")
    format.gsub!("{TabName}", "Site Photo")

    # People placeholders
    format.gsub!("{PersonName}", "Andrew Clememt")
    format.gsub!("{IDType}", "Passport")

    # Common placeholders
    format.gsub!("{Description}", "Example")
    format.gsub!("{Date}", au_date)
    format.gsub!("{Folder}", folder.presence || "GENERAL")

    # Time/DateTime placeholders
    current_time = Time.current.in_time_zone("Australia/Brisbane")
    time_24h = current_time.strftime("%H:%M")
    time_12h = current_time.strftime("%l:%M %p").strip
    short_date_time = "#{current_time.strftime('%d-%m-%y')} #{time_24h}"
    long_date_time = "#{current_time.strftime('%d %B %Y')} #{time_12h}"
    format.gsub!("{Time}", time_24h)
    format.gsub!("{TimeLong}", time_12h)
    format.gsub!("{DateTime}", short_date_time)
    format.gsub!("{DateTimeLong}", long_date_time)

    # User + DateTime placeholders (use example user)
    format.gsub!("{UserDateTime}", "RH #{short_date_time}")
    format.gsub!("{UserDateTimeLong}", "Robert Harder #{current_time.strftime('%d-%m-%Y')} #{time_24h}")

    format.strip
  end

  # Generate proposed filename for a specific job
  # Uses actual job data instead of placeholder values
  def generate_proposed_name(job:, file_extension: nil, description: nil, number: nil, user: nil, tab: nil)
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

    # Tab/folder placeholders
    tab_code = tab&.dig(:code) || tab&.dig("code") || "Site"
    tab_name = tab&.dig(:name) || tab&.dig("name") || "Site Photo"
    format.gsub!("{TabCode}", tab_code)
    format.gsub!("{TabName}", tab_name)

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

    # Time/DateTime placeholders
    current_time = Time.current.in_time_zone("Australia/Brisbane")
    time_24h = current_time.strftime("%H:%M")
    time_12h = current_time.strftime("%l:%M %p").strip
    short_date_time = "#{current_time.strftime('%d-%m-%y')} #{time_24h}"
    long_date_time = "#{current_time.strftime('%d %B %Y')} #{time_12h}"
    format.gsub!("{Time}", time_24h)
    format.gsub!("{TimeLong}", time_12h)
    format.gsub!("{DateTime}", short_date_time)
    format.gsub!("{DateTimeLong}", long_date_time)

    # User + DateTime placeholders
    user_code = user&.initials || user&.name&.split&.map { |n| n[0] }&.join&.upcase || "UN"
    user_name = user&.name || "Unknown User"
    format.gsub!("{UserDateTime}", "#{user_code} #{short_date_time}")
    format.gsub!("{UserDateTimeLong}", "#{user_name} #{current_time.strftime('%d-%m-%Y')} #{time_24h}")

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

  # ULTRA SSoT: Regenerate display_names for all linked documents when display_name template changes
  def regenerate_document_display_names
    return unless display_name.present?

    # Queue a background job to avoid blocking the save
    RegenerateDisplayNamesJob.perform_later(id) if defined?(RegenerateDisplayNamesJob)

    # For now, also do inline update for immediate effect (small batches)
    corporate_company_documents.find_each(batch_size: 100) do |doc|
      new_name = doc.expand_display_template(display_name)
      doc.update_column(:display_name, new_name) if new_name != doc.display_name
    end
  end

  # Sync pending entity_tab_ids that were deferred during create
  def sync_pending_entity_tab_ids
    return unless @pending_entity_tab_ids.present?

    sync_entity_tab_ids(@pending_entity_tab_ids)
    @pending_entity_tab_ids = nil
  end

  # Track naming format changes for standardization prompts
  # Sets naming_format_change_info attribute with affected document count
  def track_naming_format_change
    old_format, new_format = saved_change_to_file_name
    return if old_format == new_format

    # Count documents of this type that would be affected by the format change
    affected_count = documents_needing_standardization_count

    self.naming_format_change_info = {
      old_format: old_format,
      new_format: new_format,
      affected_documents_count: affected_count,
      message: affected_count > 0 ?
        "#{affected_count} documents may need to be renamed to match the new naming format." :
        "No existing documents to rename."
    }

    Rails.logger.info("[DocumentType] Naming format changed for '#{name}': #{affected_count} documents affected")
  end

  # Count documents that would need renaming with the new format
  # (those that don't already match what the new format would generate)
  def documents_needing_standardization_count
    job_documents.where(document_type_id: id).count
  end
end
