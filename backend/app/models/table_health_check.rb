# frozen_string_literal: true

# TableHealthCheck - Database registry of health checks for tables
#
# This model stores the configuration of health checks in the database.
# The actual check logic is now in HealthChecks::* service classes.
#
# For backwards compatibility, this model still supports:
#   - Looking up checks by foundation_id or table_name
#   - Executing checks via #execute
#
# NEW RECOMMENDED APPROACH:
#   Use HealthChecks::Registry directly:
#     HealthChecks::Registry.run_all(foundation_id: foundation.id)
#     HealthChecks::Registry.system_health
#
class TableHealthCheck < ApplicationRecord
  belongs_to :foundation, optional: true

  # Validations
  validates :check_type, presence: true
  validates :name, presence: true
  validates :api_endpoint, presence: true
  validates :severity, inclusion: { in: %w[critical warning info] }

  validate :foundation_or_table_name_present

  # Scopes
  scope :enabled, -> { where(enabled: true) }
  scope :by_severity, ->(severity) { where(severity: severity) }
  scope :for_foundation, ->(foundation_id) { where(foundation_id: foundation_id) }
  scope :for_table, ->(table_name) { where(table_name: table_name) }
  scope :ordered, -> { order(display_order: :asc, created_at: :asc) }

  # Severity ordering (critical first)
  SEVERITY_ORDER = HealthChecks::BaseCheck::SEVERITY_ORDER

  # ============================================================================
  # CLASS METHODS
  # ============================================================================

  # Find all health checks for a given foundation or table
  # @param identifier [Integer, String] Foundation ID or table name
  # @return [ActiveRecord::Relation]
  def self.for_table_or_foundation(identifier)
    if identifier.is_a?(Integer) || identifier.to_s.match?(/^\d+$/)
      checks = enabled.for_foundation(identifier.to_i).ordered
      return checks if checks.any?

      # Fallback to table name lookup
      foundation = Foundation.find_by(id: identifier)
      if foundation&.database_table_name.present?
        enabled.for_table(foundation.database_table_name).ordered
      else
        none
      end
    else
      enabled.for_table(identifier.to_s).ordered
    end
  end

  # Run all checks for a foundation using new service architecture
  # @param foundation_id [Integer] Foundation ID
  # @return [Hash] Health check results
  def self.run_checks_for_foundation(foundation_id)
    HealthChecks::Registry.run_all(foundation_id: foundation_id)
  end

  # Run all checks for a table using new service architecture
  # @param table_name [String] Table name
  # @return [Hash] Health check results
  def self.run_checks_for_table(table_name)
    HealthChecks::Registry.run_all(table_name: table_name)
  end

  # Get system-wide health summary
  # @return [Hash] System health data
  def self.system_health
    HealthChecks::Registry.system_health
  end

  # ============================================================================
  # INSTANCE METHODS
  # ============================================================================

  # Execute this health check
  # Delegates to appropriate HealthChecks::* service
  # @return [Hash] Check result with count, items, severity, etc.
  def execute
    Rails.logger.info "[TableHealthCheck] Executing check '#{name}' (#{check_type})"

    # Try to delegate to new service architecture
    result = delegate_to_service

    if result
      # Merge database config with service result
      result.merge(
        id: id,
        name: name,
        description: description,
        icon: icon,
        action_path: action_path
      )
    else
      # Fallback to legacy execution
      legacy_execute
    end
  rescue StandardError => e
    Rails.logger.error "[TableHealthCheck] Error executing '#{name}': #{e.message}"
    error_result(e.message)
  end

  private

  def foundation_or_table_name_present
    if foundation_id.blank? && table_name.blank?
      errors.add(:base, "Either foundation_id or table_name must be present")
    end
  end

  # Delegate to new HealthChecks::* service
  def delegate_to_service
    service_class = HealthChecks::Registry.for(foundation_id || table_name)
    return nil unless service_class

    # Map check_type/api_endpoint to service method
    method_name = infer_service_method
    return nil unless method_name

    service = service_class.new
    return nil unless service.respond_to?(method_name)

    service.send(method_name)
  end

  # Infer service method from check_type or api_endpoint
  def infer_service_method
    # Map api_endpoint patterns to service methods
    case api_endpoint
    when %r{without_default_supplier}
      :check_items_without_supplier
    when %r{without_price_history}
      :check_items_without_price_history
    when %r{missing_photos}
      :check_items_missing_photos
    when %r{price_health_check}, %r{price_mismatch}
      :check_price_mismatches
    when %r{possible_duplicates}
      :check_duplicate_names
    when %r{without_start_date}
      :check_jobs_without_start_date
    when %r{without_contract_value}
      :check_jobs_without_contract_value
    when %r{without_abn}
      :check_companies_without_abn
    when %r{without_review_date}
      :check_companies_without_review_date
    when %r{needs_ai_verification}
      :check_needs_ai_verification
    when %r{needs_user_validation}
      :check_needs_user_validation
    when %r{ato_missing_bas}
      :check_ato_missing_bas
    when %r{ato_missing_tax_return}
      :check_ato_missing_tax_return
    when %r{bank_missing_statements}
      :check_bank_missing_statements
    when %r{asic_missing_annual}
      :check_asic_missing_annual
    when %r{financials_missing_annual}
      :check_financials_missing_annual
    when %r{missing_date}
      :check_documents_missing_date
    when %r{consolidation.*mismatch}i
      :check_intercompany_mismatches
    else
      # Try to construct method name from check_type
      :"check_#{check_type}"
    end
  end

  # Legacy execution (fallback for unmapped checks)
  def legacy_execute
    Rails.logger.warn "[TableHealthCheck] Using legacy execution for '#{name}'"
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
      success: true,
      legacy: true
    }
  end

  def error_result(message)
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
      error: message
    }
  end
end
