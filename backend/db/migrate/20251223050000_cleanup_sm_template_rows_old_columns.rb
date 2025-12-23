# frozen_string_literal: true

# CleanupSmTemplateRowsOldColumns
#
# IMPORTANT: Only run this migration AFTER:
# 1. The multi-template migration has been run
# 2. The data migration rake task has been run
# 3. All code has been updated and deployed
# 4. Everything has been verified to work
#
# This migration removes the deprecated columns:
# - sm_template_id (replaced by sm_template_ids JSONB array)
# - ts_identifier (no longer needed - ID is now the identifier)
#
class CleanupSmTemplateRowsOldColumns < ActiveRecord::Migration[7.0]
  def up
    # Safety check: Ensure sm_template_ids is populated
    empty_count = execute("SELECT COUNT(*) FROM sm_template_rows WHERE sm_template_ids = '[]'::jsonb OR sm_template_ids IS NULL").first["count"]
    if empty_count.to_i > 0
      raise "Cannot proceed: #{empty_count} rows have empty sm_template_ids. Run the data migration first."
    end

    # Remove the old sm_template_id foreign key if it exists
    if foreign_key_exists?(:sm_template_rows, :sm_templates)
      remove_foreign_key :sm_template_rows, :sm_templates
    end

    # Remove the old sm_template_id index if it exists
    if index_exists?(:sm_template_rows, :sm_template_id)
      remove_index :sm_template_rows, :sm_template_id
    end

    # Drop the old columns
    remove_column :sm_template_rows, :sm_template_id
    remove_column :sm_template_rows, :ts_identifier

    # Add index on task_number for query performance (NOT unique - task_number can repeat across templates)
    unless index_exists?(:sm_template_rows, :task_number)
      add_index :sm_template_rows, :task_number
    end
  end

  def down
    # Re-add the columns
    add_column :sm_template_rows, :sm_template_id, :bigint
    add_column :sm_template_rows, :ts_identifier, :integer

    # Re-add the index
    add_index :sm_template_rows, :sm_template_id

    # Note: Data will need to be manually restored from sm_template_ids
    # This is intentionally left as a manual step
  end
end
