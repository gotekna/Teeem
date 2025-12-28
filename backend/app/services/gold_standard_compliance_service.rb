# frozen_string_literal: true

# GoldStandardComplianceService - Calculate compliance scores for foundations
#
# Compliance is measured by how many columns are using the current version
# of their type definitions. A column is compliant if:
# - It has a column_type_definition linked
# - Its type_version_applied matches the type definition's version
#
# System columns (id, created_at, updated_at) are excluded from the calculation.
# System tables (table_type='system') are skipped entirely.
class GoldStandardComplianceService
  SYSTEM_COLUMNS = %w[id created_at updated_at].freeze
  # SSoT: Use slug to identify Gold Standard Table (numeric ID differs per environment)
  GOLD_STANDARD_SLUG = "gold_standard_table"

  def initialize(foundation)
    @foundation = foundation
  end

  # Calculate compliance without saving
  def calculate
    return nil if skip_check?

    user_columns = @foundation.columns.reject { |c| SYSTEM_COLUMNS.include?(c.column_name) }
    return { score: 100.0, issues: [], total: 0, compliant: 0 } if user_columns.empty?

    issues = []
    compliant_count = 0

    user_columns.each do |column|
      if column.compliant?
        compliant_count += 1
      else
        issues << {
          column_name: column.column_name,
          column_type: column.column_type,
          reason: compliance_issue_reason(column)
        }
      end
    end

    score = (compliant_count.to_f / user_columns.size * 100).round(2)

    {
      score: score,
      issues: issues,
      total: user_columns.size,
      compliant: compliant_count
    }
  end

  # Calculate and save compliance to foundation
  def update_compliance!
    result = calculate
    return if result.nil?

    @foundation.update_columns(
      compliance_score: result[:score],
      compliance_checked_at: Time.current,
      non_compliant_columns: result[:issues]
    )

    result
  end

  # Class method to recalculate compliance for all non-system foundations
  def self.recalculate_all!
    results = []

    Foundation.where(table_type: [ "user", "import", nil ]).where.not(slug: GOLD_STANDARD_SLUG).find_each do |foundation|
      service = new(foundation)
      result = service.update_compliance!

      if result
        results << {
          id: foundation.id,
          name: foundation.name,
          score: result[:score],
          total: result[:total],
          compliant: result[:compliant]
        }
      end
    end

    results
  end

  # Class method to get system-wide compliance summary
  def self.system_summary
    foundations = Foundation.where(table_type: [ "user", "import", nil ]).where.not(slug: GOLD_STANDARD_SLUG)

    total_foundations = foundations.count
    scored_foundations = foundations.where.not(compliance_score: nil)
    avg_score = scored_foundations.average(:compliance_score)&.round(2) || 0

    {
      total_foundations: total_foundations,
      scored_foundations: scored_foundations.count,
      average_score: avg_score,
      fully_compliant: scored_foundations.where("compliance_score >= ?", 100).count,
      needs_attention: scored_foundations.where("compliance_score < ?", 70).count
    }
  end

  private

  def skip_check?
    # Skip system tables and Gold Standard table itself
    # SSoT: Use slug check, not numeric ID (which differs per environment)
    @foundation.table_type == "system" || @foundation.slug == GOLD_STANDARD_SLUG
  end

  def compliance_issue_reason(column)
    if column.column_type_definition.nil?
      "Not linked to type definition"
    elsif column.type_version_applied != column.column_type_definition.version
      "Version mismatch: has v#{column.type_version_applied}, current is v#{column.column_type_definition.version}"
    else
      "Unknown"
    end
  end
end
