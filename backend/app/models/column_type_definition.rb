# frozen_string_literal: true

# ColumnTypeDefinition - Single Source of Truth for column types
#
# This table defines all 21 column types used across TEEEM tables.
# When a type definition changes, all columns using that type are automatically updated.
#
# See: Bible Rule #19.37 - Column Types Single Source of Truth
class ColumnTypeDefinition < ApplicationRecord
  has_many :columns, dependent: :nullify

  validates :type_key, presence: true, uniqueness: true
  validates :display_name, presence: true
  validates :sql_type, presence: true

  after_save :propagate_changes_to_columns, if: :should_propagate?

  scope :active, -> { where(is_active: true) }
  scope :by_category, ->(cat) { where(category: cat) }

  # Count columns using this type (excluding system tables)
  def column_count(exclude_system: true)
    scope = columns.joins(:foundation)
    scope = scope.where.not(foundations: { table_type: "system" }) if exclude_system
    scope.count
  end

  # Count compliant columns (matching current version)
  def compliant_column_count
    columns.joins(:foundation)
           .where.not(foundations: { table_type: "system" })
           .where(type_version_applied: version)
           .count
  end

  # Calculate compliance percentage for this type
  def compliance_percentage
    total = column_count
    return 100.0 if total.zero?
    (compliant_column_count.to_f / total * 100).round(1)
  end

  # Increment version (triggers propagation)
  def increment_version!
    update!(version: version + 1, version_updated_at: Time.current)
  end

  private

  def should_propagate?
    saved_change_to_version? ||
      saved_change_to_sql_type? ||
      saved_change_to_default_max_length? ||
      saved_change_to_default_min_length? ||
      saved_change_to_default_min_value? ||
      saved_change_to_default_max_value? ||
      saved_change_to_validation_regex?
  end

  def propagate_changes_to_columns
    GoldStandardPropagationJob.perform_later(id)
  end
end
