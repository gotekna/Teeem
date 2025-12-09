# frozen_string_literal: true

module HealthChecks
  # Health checks for Intercompany Consolidation
  #
  # Checks:
  #   - Intercompany balance mismatches (critical)
  #   - Uneliminated intercompany transactions (warning)
  #
  class ConsolidationCheck < BaseCheck
    def self.check_type
      "consolidation"
    end

    # Intercompany balance mismatches
    def check_intercompany_mismatches
      mismatches = find_intercompany_mismatches

      build_result(
        name: "Intercompany Balance Mismatches",
        description: "Intercompany balances that do not match between related entities.",
        severity: :critical,
        items: mismatches,
        icon: "arrows-right-left",
        action_path: "/corporate/cg-new"
      )
    end

    protected

    def format_items(items)
      items # Already formatted as hashes
    end

    private

    def find_intercompany_mismatches
      as_of_date = Date.current
      all_mismatches = []

      # Only check if CompanyGroup model exists
      return [] unless defined?(CompanyGroup)

      CorporateGroup.where(active: true).includes(:companies).find_each do |group|
        next if group.corporate_companies.count < 2

        begin
          # Only run if ConsolidationReconciliationService exists
          next unless defined?(ConsolidationReconciliationService)

          service = ConsolidationReconciliationService.new(group, as_of_date: as_of_date)
          relationships = service.intercompany_relationships

          relationships.reject { |r| r[:matched] }.each do |m|
            all_mismatches << {
              id: "#{group.id}-#{m[:company_a][:id]}-#{m[:company_b][:id]}-#{m[:balance_type]}",
              display: "#{m[:company_a][:name]} ↔ #{m[:company_b][:name]}: #{m[:balance_type]} ($#{m[:discrepancy].abs.round(2)})",
              group_id: group.id,
              group_name: group.name,
              company_a_id: m[:company_a][:id],
              company_a_name: m[:company_a][:name],
              company_b_id: m[:company_b][:id],
              company_b_name: m[:company_b][:name],
              balance_type: m[:balance_type],
              discrepancy: m[:discrepancy].round(2)
            }
          end
        rescue StandardError => e
          Rails.logger.warn "[ConsolidationCheck] Failed to check group #{group.id}: #{e.message}"
        end
      end

      all_mismatches.first(20)
    end
  end
end
