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
                     .select(:id, :full_name, :first_name, :last_name, :email)

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
          { id: c.id, full_name: c.full_name, email: c.email }
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
end
