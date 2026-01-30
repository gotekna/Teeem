class DocumentType < ApplicationRecord
  # Multi-tenancy: Scope all queries to current tenant (Tenant model is SSoT)
  acts_as_tenant :tenant

  # Associations
  # Note: corporate_company_documents and job_documents associations REMOVED (Jan 2026) - tables dropped
  # SSoT: WarehouseDocument is now THE ONE table for document metadata

  # SSoT: WarehouseFolder associations (renamed: EntityTab → StorageLocation → WarehouseFolder, Jan 2026)
  has_many :warehouse_folder_document_types, foreign_key: :document_type_id, dependent: :destroy
  has_many :warehouse_folders, through: :warehouse_folder_document_types

  # Backwards compatibility aliases
  alias_method :storage_location_document_types, :warehouse_folder_document_types
  alias_method :storage_locations, :warehouse_folders
  def entity_tab_document_types
    warehouse_folder_document_types
  end
  has_many :entity_tabs, through: :warehouse_folder_document_types, source: :warehouse_folder

  # Get location names for display
  def location_names
    warehouse_folders.pluck(:display_name)
  end

  # Get the primary warehouse folder (uses is_primary flag from join table)
  # SSoT: is_primary flag is THE ONE way to identify the primary location
  def primary_warehouse_folder
    primary_join = warehouse_folder_document_types.find_by(is_primary: true)
    primary_join&.warehouse_folder || warehouse_folders.ordered.first
  end

  # Backwards compatibility aliases
  alias_method :primary_storage_location, :primary_warehouse_folder
  alias_method :primary_entity_tab, :primary_warehouse_folder

  # ══════════════════════════════════════════════════════════════════════════════
  # SSoT: Derived attributes from primary WarehouseFolder
  # These methods are THE ONE source of truth - columns are kept only for migration fallback
  # ══════════════════════════════════════════════════════════════════════════════

  # SSoT: Derive scope from primary WarehouseFolder's warehouse_type
  # This is THE ONE place scope is determined
  # SSoT: 'contact' is THE ONE for all individuals (Jan 2026 - 'people' merged into 'contact')
  def derived_scope
    case primary_warehouse_folder&.warehouse_type
    when 'corporate' then 'company'
    when 'job' then 'job'
    when 'contact' then 'contacts'
    else 'company'
    end
  end

  # Override scope getter to use derived value (fallback to column during migration)
  def scope
    primary_warehouse_folder.present? ? derived_scope : read_attribute(:scope)
  end

  # SSoT: folder = primary location's display name
  def folder
    primary_warehouse_folder&.display_name || read_attribute(:folder)
  end

  # SSoT: target_folder = primary location's hierarchy path
  def target_folder
    primary_warehouse_folder&.hierarchy_path || read_attribute(:target_folder)
  end

  # SSoT: primary_tab = primary location's display name (for backward compatibility)
  # Used by SmTaskPhoto for filename token resolution
  def primary_tab
    primary_warehouse_folder&.display_name || read_attribute(:primary_tab)
  end

  # SSoT: category is DEPRECATED (Jan 2026)
  # Was used for legacy folder organization, now superseded by EntityTab hierarchy
  # Returns nil - callers use .presence with "General" fallback
  def category
    nil
  end

  # SSoT: tabs is DEPRECATED (Jan 2026)
  # Was a jsonb array, now superseded by entity_tab_document_types join table
  # Returns empty array for backward compatibility with API serialization
  def tabs
    []
  end

  # Set warehouse folders by ID (renamed: entity_tab_ids → storage_location_ids → warehouse_folder_ids, Jan 2026)
  def warehouse_folder_ids=(ids)
    ids = Array(ids).map(&:to_i).reject(&:zero?)

    # For new records, store the IDs and create associations after save
    if new_record?
      @pending_warehouse_folder_ids = ids
    else
      sync_warehouse_folder_ids(ids)
    end
  end

  # Backwards compatibility aliases
  alias_method :storage_location_ids=, :warehouse_folder_ids=
  alias_method :folder_ids=, :warehouse_folder_ids=
  alias_method :folder_ids, :warehouse_folder_ids

  # Get WarehouseFolder IDs (renamed: entity_tab_ids → storage_location_ids → warehouse_folder_ids, Jan 2026)
  def warehouse_folder_ids
    warehouse_folder_document_types.pluck(:warehouse_folder_id)
  end

  # Backwards compatibility alias
  alias_method :storage_location_ids, :warehouse_folder_ids

  # Sync warehouse_folder_ids with the database
  # SSoT: Uses is_primary flag to track primary vs secondary locations
  # First ID = primary location, rest = secondary ("also show in")
  def sync_warehouse_folder_ids(ids)
    # Remove old assignments not in the new list
    warehouse_folder_document_types.where.not(warehouse_folder_id: ids).destroy_all

    # Update/create assignments with is_primary flag
    # First ID = primary, rest = secondary
    ids.each_with_index do |loc_id, index|
      is_primary = (index == 0)
      existing = warehouse_folder_document_types.find_by(warehouse_folder_id: loc_id)
      if existing
        existing.update(is_primary: is_primary) if existing.is_primary != is_primary
      else
        warehouse_folder_document_types.create(warehouse_folder_id: loc_id, is_primary: is_primary)
      end
    end

    # NOTE: primary_tab column is DEPRECATED (Jan 2026)
    # scope, folder, target_folder are now derived from primary_warehouse_folder
    # Keeping column sync for backward compatibility during migration
    if respond_to?(:has_attribute?) && has_attribute?(:primary_tab)
      primary_tab_id = ids.first
      if primary_tab_id.present?
        primary_tab_record = WarehouseFolder.find_by(id: primary_tab_id)
        update_column(:primary_tab, primary_tab_record&.display_name) if primary_tab_record
      else
        update_column(:primary_tab, nil)
      end
    end

    # SSoT: Sync scope column to match derived_scope (for uniqueness validation)
    # This keeps the column value in sync with the computed value
    if has_attribute?(:scope)
      new_scope = derived_scope
      update_column(:scope, new_scope) if read_attribute(:scope) != new_scope
    end
  end

  # Callbacks
  # SSoT: WarehouseDocument.display_name is computed dynamically via SendNameResolver
  # Sync pending warehouse_folder_ids after create (deferred from warehouse_folder_ids= setter)
  after_create :sync_pending_warehouse_folder_ids
  # Track naming format changes for standardization prompts
  after_save :track_naming_format_change, if: :saved_change_to_file_name?

  # Attribute to track naming format change details (used by API response)
  attr_accessor :naming_format_change_info

  # Validations
  # Name must be unique within each scope (company, job, contacts, both)
  # This allows the same name in different scopes (e.g., "Invoice" for both company and job)
  validates :name, presence: true, uniqueness: { scope: [:tenant_id, :scope], message: "has already been taken for this scope" }
  # Note: category field is deprecated - tabs/folders (EntityTab) are now the primary organization method

  # Scopes
  scope :active, -> { where(active: true) }
  # SSoT: by_folder queries through primary WarehouseFolder (folder column is derived)
  scope :by_folder, ->(folder) {
    joins(:warehouse_folder_document_types)
      .joins("INNER JOIN warehouse_folders ON warehouse_folders.id = warehouse_folder_document_types.warehouse_folder_id")
      .where(warehouse_folder_document_types: { is_primary: true })
      .where(warehouse_folders: { display_name: folder })
  }
  # DEPRECATED: category column removed (Jan 2026) - returns no results
  scope :by_category, ->(_category) { none }
  scope :by_scope, ->(scope_name) { where(scope: scope_name) }
  scope :for_company, -> { where(scope: %w[company both]) }
  scope :for_job, -> { where(scope: %w[job both]) }
  # SSoT: "contacts" is THE ONE scope for all individuals (Jan 2026 consolidation)
  scope :for_contacts, -> { where(scope: 'contacts') }
  scope :requiring_filing, -> { where(requires_filing: true) }
  scope :supporting_versioning, -> { where(supports_versioning: true) }

  # Check if this document type supports Draft/Signed versioning
  def versionable?
    supports_versioning == true
  end

  # Check if this document type auto-generates certificates on task completion
  def generates_certificate?
    generates_certificate == true
  end

  # Human-readable name for certificate template
  def certificate_template_display
    case certificate_template
    when "form_43"
      "Form 43 - Aspect Certificate"
    when "form_16"
      "Form 16 - Final Inspection Certificate"
    else
      certificate_template&.titleize || "Certificate"
    end
  end

  # Resolve form number based on dwelling type using the configured mapping
  # Returns the mapped value, or first mapping as fallback if dwelling type not found
  # Example mapping: { "Class 1A" => "Form 15", "Class 10" => "Form 21" }
  def resolve_form_number(dwelling_type)
    return "" if form_number_mapping.blank?

    # If no dwelling type provided, return first mapping as default
    return form_number_mapping.values.first || "" if dwelling_type.blank?

    # Try exact match first
    form_number_mapping[dwelling_type] ||
      # Try case-insensitive match
      form_number_mapping.find { |k, _| k.downcase == dwelling_type.downcase }&.last ||
      # Return default if configured
      form_number_mapping["default"] ||
      # Fallback to first mapping in the list
      form_number_mapping.values.first ||
      ""
  end

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

  # SSoT: Get the catch-all "General Documents" type for a given scope
  # Used during document migration when no specific type match is found
  # The catch-all type preserves the original filename via {OriginalFileName} placeholder
  #
  # @param scope_name [String] The scope ('company', 'job', 'contacts')
  # @return [DocumentType, nil] The catch-all document type for the scope
  def self.catchall_for_scope(scope_name)
    find_by(name: 'General Documents', scope: scope_name, active: true)
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

  # Group document types by folder (derived from primary WarehouseFolder)
  # SSoT: folder is computed from primary_warehouse_folder.display_name
  def self.grouped_by_folder
    # Eager load warehouse_folders to prevent N+1, then group by computed folder
    active.includes(warehouse_folder_document_types: :warehouse_folder)
          .order(:name)
          .group_by(&:folder)
          .sort_by { |folder, _| folder || "" }
          .to_h
  end

  # Generate a preview title showing what the document will look like when named
  # Replaces placeholders with example values, date in AU format (DD-MM-YYYY)
  def title_preview
    return nil if file_name.blank?

    # Australian date format (DD-MM-YYYY)
    au_date = Date.current.strftime("%d-%m-%Y")

    format = file_name.dup

    # Replace all placeholders with example values
    # Corporate placeholders (SSoT: CorporateCompanySetting for company name)
    format.gsub!("{CompanyCode}", abbreviation.presence || "ABC")
    format.gsub!("{CompanyName}", "ABC Property Trust")
    format.gsub!("{CompanyGroup}", CorporateCompanySetting.instance.company_name)
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
    current_time = CorporateCompanySetting.now
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

    # Job placeholders - SSoT: use database column, not hardcoded pattern
    job_code = job.job_code
    job_title = job.title.to_s.split(",").first.to_s.strip.gsub(/[^\w\s-]/, "").strip[0..30] # First part of address, sanitized

    format.gsub!("{JobCode}", job_code)
    format.gsub!("{JobTitle}", job_title)
    format.gsub!("{CertType}", description.presence || "Cert")
    format.gsub!("{Consultant}", description.presence || "Consultant")

    # Form number based on dwelling type mapping
    form_number = resolve_form_number(job.dwelling_type)
    format.gsub!("{FormNumber}", form_number)
    format.gsub!("{DwellingType}", job.dwelling_type.presence || "")
    format.gsub!("{Number}", number.to_s.rjust(2, "0"))
    format.gsub!("{Category}", category.presence || "General")

    # Tab/folder placeholders
    tab_code = tab&.dig(:code) || tab&.dig("code") || "Site"
    tab_name = tab&.dig(:name) || tab&.dig("name") || "Site Photo"
    format.gsub!("{TabCode}", tab_code)
    format.gsub!("{TabName}", tab_name)

    # Corporate placeholders (SSoT: CorporateCompanySetting for company name)
    format.gsub!("{CompanyCode}", abbreviation.presence || "ABC")
    format.gsub!("{CompanyName}", "ABC Property Trust")
    format.gsub!("{CompanyGroup}", CorporateCompanySetting.instance.company_name)
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
    current_time = CorporateCompanySetting.now
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

  # Sync pending warehouse_folder_ids that were deferred during create
  def sync_pending_warehouse_folder_ids
    return unless @pending_warehouse_folder_ids.present?

    sync_warehouse_folder_ids(@pending_warehouse_folder_ids)
    @pending_warehouse_folder_ids = nil
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
  # NOTE: WarehouseDocument doesn't track document_type_id, so we return 0
  # In the future, document types could be inferred from folder/source_type
  def documents_needing_standardization_count
    0
  end
end
