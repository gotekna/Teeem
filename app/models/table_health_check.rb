# TableHealthCheck - Registry of health checks for tables
#
# Each record defines a health check that can be run against a table.
# Health checks are looked up either by foundation_id (for user-created tables)
# or by table_name (for system tables like contacts, jobs, etc.)
#
# Example checks:
# - Duplicate contacts (table_name: 'contacts', check_type: 'duplicates')
# - Missing default supplier (foundation_id: 205, check_type: 'missing_required')
# - Price mismatches (foundation_id: 205, check_type: 'data_mismatch')
#
class TableHealthCheck < ApplicationRecord
  belongs_to :foundation, optional: true  # Optional for system tables

  # Validations
  validates :check_type, presence: true
  validates :name, presence: true
  validates :api_endpoint, presence: true
  validates :severity, inclusion: { in: %w[critical warning info] }

  # At least one identifier must be present
  validate :foundation_or_table_name_present

  # Scopes
  scope :enabled, -> { where(enabled: true) }
  scope :by_severity, ->(severity) { where(severity: severity) }
  scope :for_foundation, ->(foundation_id) { where(foundation_id: foundation_id) }
  scope :for_table, ->(table_name) { where(table_name: table_name) }
  scope :ordered, -> { order(display_order: :asc, created_at: :asc) }

  # Severity levels (for display ordering)
  SEVERITY_ORDER = { 'critical' => 0, 'warning' => 1, 'info' => 2 }.freeze

  # Find all health checks for a given foundation or table
  # Can be called with either a foundation_id (integer) or table_name (string)
  def self.for_table_or_foundation(identifier)
    if identifier.is_a?(Integer) || identifier.to_s.match?(/^\d+$/)
      # Look up by foundation_id first
      checks = enabled.for_foundation(identifier.to_i).ordered
      return checks if checks.any?

      # If no checks found by ID, try to find the foundation and look up by table name
      foundation = Foundation.find_by(id: identifier)
      if foundation&.database_table_name.present?
        enabled.for_table(foundation.database_table_name).ordered
      else
        none
      end
    else
      # Look up by table name (string)
      enabled.for_table(identifier.to_s).ordered
    end
  end

  # Execute this health check and return results
  # Returns { success: true/false, count: N, items: [...] }
  def execute
    Rails.logger.info "[TableHealthCheck] Executing check '#{name}' via #{api_endpoint}"
    result = fetch_check_results
    {
      id: id,
      check_type: check_type,
      name: name,
      description: description,
      severity: severity,
      icon: icon,
      action_path: action_path,
      count: result[:count] || 0,
      items: result[:items] || [],
      success: result[:success] != false
    }
  rescue => e
    Rails.logger.error "[TableHealthCheck] Error executing '#{name}': #{e.message}"
    {
      id: id,
      check_type: check_type,
      name: name,
      description: description,
      severity: severity,
      icon: icon,
      action_path: action_path,
      count: 0,
      items: [],
      success: false,
      error: e.message
    }
  end

  private

  def foundation_or_table_name_present
    if foundation_id.blank? && table_name.blank?
      errors.add(:base, "Either foundation_id or table_name must be present")
    end
  end

  # Fetch results from the configured API endpoint
  # This calls the endpoint internally (not via HTTP) for efficiency
  def fetch_check_results
    # Parse the endpoint to determine which controller/action to call
    # Expected formats:
    # - /api/v1/contacts/possible_duplicates
    # - /api/v1/health/pricebook
    # - /api/v1/pricebook/price_health_check

    case api_endpoint
    when '/api/v1/contacts/possible_duplicates'
      fetch_duplicate_contacts
    when '/api/v1/health/pricebook'
      fetch_pricebook_health
    when %r{/api/v1/pricebook_items/without_default_supplier}
      fetch_items_without_default_supplier
    when %r{/api/v1/pricebook_items/without_price_history}
      fetch_items_without_price_history
    when %r{/api/v1/pricebook_items/missing_photos}
      fetch_items_missing_photos
    when %r{/api/v1/pricebook/price_health_check}
      fetch_price_mismatches
    # Jobs health checks
    when %r{/api/v1/jobs/without_start_date}
      fetch_jobs_without_start_date
    when %r{/api/v1/jobs/without_contract_value}
      fetch_jobs_without_contract_value
    # Companies health checks
    when %r{/api/v1/companies/without_abn}
      fetch_companies_without_abn
    when %r{/api/v1/companies/without_review_date}
      fetch_companies_without_review_date
    # Company Documents health checks
    when %r{/api/v1/company_documents/needs_ai_verification}
      fetch_documents_needs_ai_verification
    when %r{/api/v1/company_documents/needs_user_validation}
      fetch_documents_needs_user_validation
    # Document Compliance health checks (tab-based)
    when %r{/api/v1/company_documents/ato_missing_bas}
      fetch_ato_missing_bas
    when %r{/api/v1/company_documents/ato_missing_tax_return}
      fetch_ato_missing_tax_return
    when %r{/api/v1/company_documents/bank_missing_statements}
      fetch_bank_missing_statements
    when %r{/api/v1/company_documents/asic_missing_annual}
      fetch_asic_missing_annual
    when %r{/api/v1/company_documents/financials_missing_annual}
      fetch_financials_missing_annual
    when %r{/api/v1/company_documents/missing_date}
      fetch_documents_missing_date
    when %r{/api/v1/company_documents/missing_fy}
      fetch_documents_missing_fy
    else
      # For unknown endpoints, return empty result
      Rails.logger.warn "[TableHealthCheck] Unknown endpoint: #{api_endpoint}"
      { count: 0, items: [] }
    end
  end

  def fetch_duplicate_contacts
    # Use the same logic as contacts_controller#possible_duplicates
    duplicates = find_duplicate_groups
    {
      count: duplicates.sum { |group| group[:contacts].size },
      items: duplicates.first(10).map { |group|
        {
          id: group[:contacts].first[:id],
          display: "#{group[:contacts].size} contacts: #{group[:contacts].map { |c| c[:full_name] }.join(', ')}",
          match_type: group[:match_type],
          contacts: group[:contacts]
        }
      },
      groups_count: duplicates.size
    }
  end

  def find_duplicate_groups
    # Find contacts with duplicate names (normalized)
    contacts = Contact.where(deleted: [false, nil])
                     .select(:id, :full_name, :first_name, :last_name, :email, :mobile_phone, :office_phone, :xero_id, :xero_contact_status)

    groups = []
    seen_ids = Set.new

    # Group by normalized full name
    by_name = contacts.group_by { |c| normalize_name(c.full_name) }
    by_name.each do |normalized, group|
      next if normalized.blank? || group.size < 2
      next if group.all? { |c| seen_ids.include?(c.id) }

      groups << {
        match_type: 'name',
        match_value: normalized,
        contacts: group.map { |c|
          seen_ids << c.id
          {
            id: c.id,
            full_name: c.full_name,
            email: c.email,
            mobile_phone: c.mobile_phone,
            office_phone: c.office_phone,
            xero_id: c.xero_id,
            xero_status: c.xero_contact_status
          }
        }
      }
    end

    groups
  end

  def normalize_name(name)
    return nil if name.blank?
    name.to_s.downcase.gsub(/\s+/, ' ').strip
  end

  def fetch_pricebook_health
    # Aggregate multiple pricebook checks
    items_without_supplier = PricebookItem.active.where(default_supplier_id: nil).count
    {
      count: items_without_supplier,
      items: PricebookItem.active.where(default_supplier_id: nil)
                         .select(:id, :item_code, :item_name)
                         .limit(10)
                         .map { |i| { id: i.id, display: "#{i.item_code} - #{i.item_name}" } }
    }
  end

  def fetch_items_without_default_supplier
    items = PricebookItem.active.where(default_supplier_id: nil)
    {
      count: items.count,
      items: items.select(:id, :item_code, :item_name).limit(10).map { |i|
        { id: i.id, display: "#{i.item_code} - #{i.item_name}" }
      }
    }
  end

  def fetch_items_without_price_history
    items = PricebookItem.active
                        .where.not(default_supplier_id: nil)
                        .left_joins(:price_histories)
                        .where(price_histories: { id: nil })
    {
      count: items.count,
      items: items.select('pricebook_items.id, pricebook_items.item_code, pricebook_items.item_name')
                 .limit(10).map { |i|
        { id: i.id, display: "#{i.item_code} - #{i.item_name}" }
      }
    }
  end

  def fetch_items_missing_photos
    items = PricebookItem.active
                        .where(requires_photo: true)
                        .where("image_url IS NULL OR image_url = ''")
    {
      count: items.count,
      items: items.select(:id, :item_code, :item_name).limit(10).map { |i|
        { id: i.id, display: "#{i.item_code} - #{i.item_name}" }
      }
    }
  end

  def fetch_price_mismatches
    # Items where current_price doesn't match the latest price history
    mismatches = []
    PricebookItem.active.where.not(default_supplier_id: nil).find_each do |item|
      latest_price = item.price_histories.order(effective_date: :desc).first
      next unless latest_price
      next if item.current_price == latest_price.new_price

      mismatches << {
        id: item.id,
        display: "#{item.item_code}: $#{item.current_price} vs $#{latest_price.new_price}",
        current: item.current_price,
        history: latest_price.new_price
      }
      break if mismatches.size >= 10
    end

    {
      count: mismatches.size,  # Note: This is just a sample, not full count
      items: mismatches
    }
  end

  # Jobs health check methods
  def fetch_jobs_without_start_date
    jobs = Job.where(start_date: nil)
    {
      count: jobs.count,
      items: jobs.select(:id, :title, :ted_number).limit(10).map { |j|
        { id: j.id, display: "#{j.ted_number || 'No TED'} - #{j.title}" }
      }
    }
  end

  def fetch_jobs_without_contract_value
    jobs = Job.where(contract_value: [nil, 0])
    {
      count: jobs.count,
      items: jobs.select(:id, :title, :ted_number).limit(10).map { |j|
        { id: j.id, display: "#{j.ted_number || 'No TED'} - #{j.title}" }
      }
    }
  end

  # Companies health check methods
  def fetch_companies_without_abn
    companies = Company.where(abn: [nil, ''])
    {
      count: companies.count,
      items: companies.select(:id, :name, :code).limit(10).map { |c|
        { id: c.id, display: "#{c.code || c.id} - #{c.name}" }
      }
    }
  end

  def fetch_companies_without_review_date
    companies = Company.where(review_date: nil)
    {
      count: companies.count,
      items: companies.select(:id, :name, :code).limit(10).map { |c|
        { id: c.id, display: "#{c.code || c.id} - #{c.name}" }
      }
    }
  end

  # Company Documents health check methods
  def fetch_documents_needs_ai_verification
    docs = CompanyDocument.where(ai_verification_status: [nil, 'pending'])
    {
      count: docs.count,
      items: docs.includes(:company).limit(10).map { |d|
        {
          id: d.id,
          display: "#{d.company&.name || 'Unknown'} - #{d.file_name || d.title || 'Unnamed'}",
          company_id: d.company_id
        }
      }
    }
  end

  def fetch_documents_needs_user_validation
    docs = CompanyDocument.where(validation_required: true, user_validated_at: nil)
    {
      count: docs.count,
      items: docs.includes(:company).limit(10).map { |d|
        {
          id: d.id,
          display: "#{d.company&.name || 'Unknown'} - #{d.file_name || d.title || 'Unnamed'}",
          company_id: d.company_id
        }
      }
    }
  end

  # ============================================================================
  # Document Compliance Health Checks (Tab-Based)
  # ============================================================================

  # Australian Financial Year runs July 1 to June 30
  # Current FY: if today is after July 1, FY is current year, else previous year
  def current_financial_year
    today = Date.current
    today.month >= 7 ? today.year : today.year - 1
  end

  def current_quarter
    # BAS quarters: Jul-Sep (Q1), Oct-Dec (Q2), Jan-Mar (Q3), Apr-Jun (Q4)
    month = Date.current.month
    case month
    when 7..9 then 1
    when 10..12 then 2
    when 1..3 then 3
    when 4..6 then 4
    end
  end

  # ATO: Missing Quarterly BAS
  def fetch_ato_missing_bas
    fy = current_financial_year
    # Get all active companies
    companies = Company.where(active: [true, nil])

    # Find companies that have BAS documents for recent quarters
    companies_with_bas = CompanyDocument
      .where(folder: 'ATO')
      .where("LOWER(document_type) LIKE '%bas%' OR LOWER(title) LIKE '%bas%'")
      .where("? = ANY(financial_years) OR year = ?", fy, fy)
      .pluck(:company_id)
      .uniq

    # Companies missing BAS
    missing = companies.where.not(id: companies_with_bas)

    {
      count: missing.count,
      items: missing.limit(10).map { |c|
        {
          id: c.id,
          display: "#{c.code || c.id} - #{c.name}",
          company_id: c.id
        }
      }
    }
  end

  # ATO: Missing Annual Tax Return
  def fetch_ato_missing_tax_return
    fy = current_financial_year - 1  # Check for last completed FY
    companies = Company.where(active: [true, nil])

    companies_with_tax = CompanyDocument
      .where(folder: 'ATO')
      .where("LOWER(document_type) LIKE '%tax%return%' OR LOWER(title) LIKE '%ctr%' OR LOWER(title) LIKE '%tax return%'")
      .where("? = ANY(financial_years) OR year = ?", fy, fy)
      .pluck(:company_id)
      .uniq

    missing = companies.where.not(id: companies_with_tax)

    {
      count: missing.count,
      items: missing.limit(10).map { |c|
        {
          id: c.id,
          display: "#{c.code || c.id} - #{c.name} (FY#{fy})",
          company_id: c.id
        }
      }
    }
  end

  # BANK: Missing Monthly Bank Statements
  def fetch_bank_missing_statements
    # Check last 3 months
    recent_months = (0..2).map { |i| Date.current.beginning_of_month - i.months }
    companies = Company.where(active: [true, nil])

    # Find companies with bank statements for recent months
    companies_with_statements = CompanyDocument
      .where(folder: 'BANK')
      .where("LOWER(document_type) LIKE '%statement%' OR LOWER(title) LIKE '%statement%'")
      .where("document_date >= ?", 3.months.ago)
      .pluck(:company_id)
      .uniq

    missing = companies.where.not(id: companies_with_statements)

    {
      count: missing.count,
      items: missing.limit(10).map { |c|
        {
          id: c.id,
          display: "#{c.code || c.id} - #{c.name}",
          company_id: c.id
        }
      }
    }
  end

  # ASIC: Missing Annual Statement
  def fetch_asic_missing_annual
    current_year = Date.current.year
    companies = Company.where(active: [true, nil])

    companies_with_asic = CompanyDocument
      .where(folder: 'ASIC')
      .where("LOWER(document_type) LIKE '%annual%' OR LOWER(title) LIKE '%annual%statement%'")
      .where("EXTRACT(year FROM document_date) = ? OR year = ?", current_year, current_year)
      .pluck(:company_id)
      .uniq

    missing = companies.where.not(id: companies_with_asic)

    {
      count: missing.count,
      items: missing.limit(10).map { |c|
        {
          id: c.id,
          display: "#{c.code || c.id} - #{c.name} (#{current_year})",
          company_id: c.id
        }
      }
    }
  end

  # FINANCIALS: Missing Annual Financial Statements
  def fetch_financials_missing_annual
    fy = current_financial_year - 1  # Check for last completed FY
    companies = Company.where(active: [true, nil])

    companies_with_financials = CompanyDocument
      .where(folder: 'FINANCIALS')
      .where("LOWER(document_type) LIKE '%financial%' OR LOWER(title) LIKE '%financial%'")
      .where("? = ANY(financial_years) OR year = ?", fy, fy)
      .pluck(:company_id)
      .uniq

    missing = companies.where.not(id: companies_with_financials)

    {
      count: missing.count,
      items: missing.limit(10).map { |c|
        {
          id: c.id,
          display: "#{c.code || c.id} - #{c.name} (FY#{fy})",
          company_id: c.id
        }
      }
    }
  end

  # General: Documents Missing Date
  def fetch_documents_missing_date
    docs = CompanyDocument.where(document_date: nil)
    {
      count: docs.count,
      items: docs.includes(:company).limit(10).map { |d|
        {
          id: d.id,
          display: "#{d.company&.name || 'Unknown'} - #{d.title || 'Unnamed'}",
          company_id: d.company_id
        }
      }
    }
  end

  # General: Documents Missing Financial Year
  def fetch_documents_missing_fy
    # Documents without financial_years array populated
    docs = CompanyDocument.where("financial_years IS NULL OR financial_years = '{}'")
    {
      count: docs.count,
      items: docs.includes(:company).limit(10).map { |d|
        {
          id: d.id,
          display: "#{d.company&.name || 'Unknown'} - #{d.title || 'Unnamed'}",
          company_id: d.company_id
        }
      }
    }
  end
end
