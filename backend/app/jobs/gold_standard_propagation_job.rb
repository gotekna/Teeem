# frozen_string_literal: true

# GoldStandardPropagationJob - Auto-fix columns when type definitions change
#
# When a ColumnTypeDefinition is updated, this job:
# 1. Finds all columns using that type (excluding system tables)
# 2. Applies the new type definition settings to each column
# 3. Recalculates compliance scores for affected foundations
#
# This implements the "Auto-Fix" behavior requested by the user.
class GoldStandardPropagationJob < ApplicationJob
  queue_as :default

  def perform(column_type_definition_id)
    type_def = ColumnTypeDefinition.find_by(id: column_type_definition_id)
    return unless type_def

    Rails.logger.info "[GoldStandardPropagation] Starting propagation for type '#{type_def.type_key}' (version #{type_def.version})"

    # Find all columns using this type (excluding system tables)
    affected_columns = Column
      .joins(:foundation)
      .where(column_type_definition_id: type_def.id)
      .where.not(foundations: { table_type: "system" })

    column_count = affected_columns.count
    Rails.logger.info "[GoldStandardPropagation] Found #{column_count} columns to update"

    # Auto-fix each column
    updated_count = 0
    affected_columns.find_each do |column|
      begin
        column.apply_type_definition!
        updated_count += 1
      rescue => e
        Rails.logger.error "[GoldStandardPropagation] Failed to update column #{column.id}: #{e.message}"
      end
    end

    # Recalculate compliance for affected foundations
    affected_foundation_ids = affected_columns.pluck(:foundation_id).uniq
    Rails.logger.info "[GoldStandardPropagation] Recalculating compliance for #{affected_foundation_ids.count} foundations"

    Foundation.where(id: affected_foundation_ids).find_each do |foundation|
      GoldStandardComplianceService.new(foundation).update_compliance!
    end

    Rails.logger.info "[GoldStandardPropagation] Completed: Updated #{updated_count}/#{column_count} columns for type '#{type_def.type_key}'"
  end
end
