# frozen_string_literal: true

module HealthChecks
  # Registry of all health check services
  # Maps foundation IDs and table names to their check services
  #
  # Usage:
  #   # Get checks for a foundation
  #   HealthChecks::Registry.for_foundation(205)  # => HealthChecks::PricebookCheck
  #
  #   # Run all checks for a foundation
  #   HealthChecks::Registry.run_all(foundation_id: 205)
  #
  #   # Get system-wide health summary
  #   HealthChecks::Registry.system_health
  #
  class Registry
    # Map foundation IDs to check services
    FOUNDATION_CHECKS = {
      204 => JobsCheck,
      205 => PricebookCheck,
      353 => CompaniesCheck,
      357 => DocumentsCheck
    }.freeze

    # Map table names to check services
    TABLE_CHECKS = {
      'contacts' => ContactsCheck,
      'jobs' => JobsCheck,
      'pricebook' => PricebookCheck,
      'pricebook_items' => PricebookCheck,
      'companies' => CompaniesCheck,
      'company_documents' => DocumentsCheck
    }.freeze

    # All available check services
    ALL_SERVICES = [
      PricebookCheck,
      ContactsCheck,
      JobsCheck,
      CompaniesCheck,
      DocumentsCheck,
      ConsolidationCheck
    ].freeze

    class << self
      # Get check service for a foundation ID
      def for_foundation(foundation_id)
        FOUNDATION_CHECKS[foundation_id.to_i]
      end

      # Get check service for a table name
      def for_table(table_name)
        TABLE_CHECKS[table_name.to_s.downcase]
      end

      # Get check service by foundation ID or table name
      def for(identifier)
        if identifier.is_a?(Integer) || identifier.to_s.match?(/^\d+$/)
          for_foundation(identifier.to_i) || find_by_foundation_table_name(identifier)
        else
          for_table(identifier.to_s)
        end
      end

      # Run all checks for a foundation/table
      # Returns standardized health response
      def run_all(foundation_id: nil, table_name: nil)
        service_class = if foundation_id
                         for_foundation(foundation_id) || for_table(table_name)
                       else
                         for_table(table_name)
                       end

        return empty_response unless service_class

        service = service_class.new
        results = service.run_all

        build_response(results, foundation_id: foundation_id, table_name: table_name)
      end

      # Run a specific check
      def run_check(check_type, check_name)
        service_class = ALL_SERVICES.find { |s| s.check_type == check_type.to_s }
        return nil unless service_class

        service_class.new.run(check_name)
      end

      # Get system-wide health summary
      # Runs critical checks across all services
      def system_health
        results = []
        total_critical = 0
        total_warnings = 0
        total_info = 0

        ALL_SERVICES.each do |service_class|
          begin
            service = service_class.new
            checks = service.run_all

            checks.each do |check|
              count = check[:count] || 0
              case check[:severity]
              when 'critical'
                total_critical += count
              when 'warning'
                total_warnings += count
              when 'info'
                total_info += count
              end

              # Include checks with issues
              results << check.merge(check_type: service_class.check_type) if count > 0
            end
          rescue StandardError => e
            Rails.logger.error "[HealthChecks::Registry] Error running #{service_class}: #{e.message}"
          end
        end

        overall_score = BaseCheck.calculate_health_score(results)

        {
          success: true,
          overall_health: overall_score,
          status: health_status(overall_score),
          summary: {
            critical: total_critical,
            warnings: total_warnings,
            info: total_info,
            total: total_critical + total_warnings + total_info
          },
          checks: BaseCheck.sort_by_severity(results),
          checked_at: Time.current.iso8601
        }
      end

      # List all registered checks
      def all_checks
        ALL_SERVICES.flat_map do |service_class|
          service_class.available_checks.map do |method|
            {
              service: service_class.check_type,
              method: method.to_s,
              full_name: "#{service_class.check_type}.#{method}"
            }
          end
        end
      end

      private

      def find_by_foundation_table_name(foundation_id)
        foundation = Foundation.find_by(id: foundation_id)
        return nil unless foundation&.database_table_name

        for_table(foundation.database_table_name)
      end

      def empty_response
        {
          success: true,
          overall_health: 100,
          total_issues: 0,
          has_issues: false,
          checks: [],
          checked_at: Time.current.iso8601
        }
      end

      def build_response(results, foundation_id: nil, table_name: nil)
        total_issues = results.sum { |r| r[:count] || 0 }
        overall_health = BaseCheck.calculate_health_score(results)

        {
          success: true,
          foundation_id: foundation_id,
          table_name: table_name,
          overall_health: overall_health,
          total_issues: total_issues,
          has_issues: total_issues > 0,
          checks: BaseCheck.sort_by_severity(results),
          checked_at: Time.current.iso8601
        }
      end

      def health_status(score)
        if score >= 90
          'healthy'
        elsif score >= 70
          'warning'
        else
          'critical'
        end
      end
    end
  end
end
