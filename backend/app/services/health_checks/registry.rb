# frozen_string_literal: true

module HealthChecks
  # Registry of all health check services
  # Maps foundation slugs and table names to their check services
  #
  # Usage:
  #   # Get checks for a foundation (resolves to slug internally)
  #   HealthChecks::Registry.for_foundation(pricebook_foundation.id)  # => HealthChecks::PricebookCheck
  #
  #   # Run all checks for a foundation
  #   HealthChecks::Registry.run_all(foundation_id: pricebook.id)
  #
  #   # Get system-wide health summary
  #   HealthChecks::Registry.system_health
  #
  class Registry
    # SSoT: Map foundation SLUGS to check services (not numeric IDs which differ per environment)
    FOUNDATION_SLUG_CHECKS = {
      'jobs' => JobsCheck,
      'pricebook-items' => PricebookCheck,
      'corporate_companies' => CompaniesCheck,
      'company_documents' => DocumentsCheck
    }.freeze

    # Map table names to check services
    TABLE_CHECKS = {
      "contacts" => ContactsCheck,
      "jobs" => JobsCheck,
      "pricebook" => PricebookCheck,
      "pricebook_items" => PricebookCheck,
      "companies" => CompaniesCheck,
      "company_documents" => DocumentsCheck
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

    # Map check types to frontend route slugs
    ROUTE_SLUGS = {
      "pricebook" => "pricebook",
      "contacts" => "contacts",
      "jobs" => "jobs",
      "companies" => "corporate",
      "company_documents" => "documents",
      "consolidation" => nil # No direct route for consolidation checks
    }.freeze

    class << self
      # Get check service for a foundation (by ID or Foundation object)
      # SSoT: Resolves to slug internally, not hardcoded numeric IDs
      def for_foundation(foundation_or_id)
        slug = if foundation_or_id.is_a?(Foundation)
                 foundation_or_id.slug
               else
                 Foundation.find_by(id: foundation_or_id)&.slug
               end
        FOUNDATION_SLUG_CHECKS[slug]
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
        all_results = []
        module_summaries = []
        total_critical = 0
        total_warnings = 0
        total_info = 0
        total_checks = 0

        ALL_SERVICES.each do |service_class|
          begin
            service = service_class.new
            checks = service.run_all
            total_checks += checks.length

            module_critical = 0
            module_warnings = 0
            module_info = 0

            checks.each do |check|
              count = check[:count] || 0
              case check[:severity]
              when "critical"
                total_critical += count
                module_critical += count
              when "warning"
                total_warnings += count
                module_warnings += count
              when "info"
                total_info += count
                module_info += count
              end

              # Include checks with issues for detailed view
              all_results << check.merge(check_type: service_class.check_type) if count > 0
            end

            # Calculate health score for this module
            module_score = BaseCheck.calculate_health_score(checks)

            # Get foundation info if available
            foundation_id = service_class.respond_to?(:foundation_id) ? service_class.foundation_id : nil
            foundation_name = service_class.check_type.titleize
            route_slug = ROUTE_SLUGS[service_class.check_type]

            module_summaries << {
              foundation_id: foundation_id,
              foundation_name: foundation_name,
              route_slug: route_slug,
              health_score: module_score,
              total_issues: module_critical + module_warnings + module_info,
              critical_issues: module_critical,
              warning_issues: module_warnings,
              info_issues: module_info,
              checks_count: checks.length
            }
          rescue StandardError => e
            Rails.logger.error "[HealthChecks::Registry] Error running #{service_class}: #{e.message}"
          end
        end

        overall_score = BaseCheck.calculate_health_score(all_results)

        {
          success: true,
          overall_health: overall_score,
          status: health_status(overall_score),
          summary: {
            total_checks: total_checks,
            passed_checks: total_checks - all_results.length,
            failed_checks: all_results.length,
            critical_issues: total_critical,
            warning_issues: total_warnings,
            info_issues: total_info,
            total_issues: total_critical + total_warnings + total_info
          },
          checks: module_summaries.sort_by { |m| m[:health_score] },
          detailed_issues: BaseCheck.sort_by_severity(all_results),
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
              display_name: "#{service_class.check_type}.#{method}"
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
          "healthy"
        elsif score >= 70
          "warning"
        else
          "critical"
        end
      end
    end
  end
end
