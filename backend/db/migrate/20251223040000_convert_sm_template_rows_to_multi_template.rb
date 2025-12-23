# frozen_string_literal: true

# ConvertSmTemplateRowsToMultiTemplate
#
# This migration converts sm_template_rows from a single template relationship
# to a multi-template relationship using a JSONB array.
#
# BEFORE: sm_template_id (single FK) - one row per template
# AFTER:  sm_template_ids (JSONB array) - one row can belong to multiple templates
#
# This eliminates duplicate rows and allows ID = ts_identifier
#
class ConvertSmTemplateRowsToMultiTemplate < ActiveRecord::Migration[7.0]
  def up
    # Step 1: Add new column for multi-template lookup (idempotent)
    unless column_exists?(:sm_template_rows, :sm_template_ids)
      add_column :sm_template_rows, :sm_template_ids, :jsonb, default: []
    end

    # Step 2: Populate sm_template_ids from current sm_template_id
    # Only populate if the column is empty (idempotent)
    execute <<-SQL
      UPDATE sm_template_rows
      SET sm_template_ids = jsonb_build_array(sm_template_id)
      WHERE sm_template_ids = '[]'::jsonb OR sm_template_ids IS NULL
    SQL

    # Step 3: Add GIN index for efficient JSONB containment queries (idempotent)
    unless index_exists?(:sm_template_rows, :sm_template_ids)
      add_index :sm_template_rows, :sm_template_ids, using: :gin
    end

    # Step 4: Drop old unique constraint (sm_template_id, task_number) (idempotent)
    # This constraint no longer makes sense with multi-template
    if index_exists?(:sm_template_rows, name: "index_sm_template_rows_on_sm_template_id_and_task_number")
      remove_index :sm_template_rows, name: "index_sm_template_rows_on_sm_template_id_and_task_number"
    end

    # Note: We'll add unique constraint on task_number after data migration
    # and drop sm_template_id + ts_identifier columns in a separate migration
  end

  def down
    remove_index :sm_template_rows, :sm_template_ids if index_exists?(:sm_template_rows, :sm_template_ids)
    remove_column :sm_template_rows, :sm_template_ids

    # Re-add the original unique constraint
    add_index :sm_template_rows, [:sm_template_id, :task_number], unique: true
  end
end
