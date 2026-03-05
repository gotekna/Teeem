# frozen_string_literal: true

# Remove the entire legacy Plans system:
# - "Plan" warehouse folders (superseded by "Plans" + DocumentTypes)
# - All 8 plan_* tables (plan_types, plan_categories, etc.)
# - FK columns referencing plan_types/plan_categories from other tables
#
# DocumentTypes now handle plan classification (76 unique plan document types).
class RemoveLegacyPlanWarehouseFolders < ActiveRecord::Migration[8.0]
  def up
    # 1. Delete legacy "Plan" warehouse folders and their WFDTs
    plan_folder_ids = execute(<<~SQL).map { |r| r["id"] }
      SELECT id FROM warehouse_folders WHERE LOWER(name) = 'plan'
    SQL

    unless plan_folder_ids.empty?
      execute("DELETE FROM warehouse_folder_document_types WHERE warehouse_folder_id IN (#{plan_folder_ids.join(",")})")
      execute("DELETE FROM warehouse_folders WHERE id IN (#{plan_folder_ids.join(",")})")
    end

    # 2. Remove FK columns from tables that reference plan_types/plan_categories
    # Guard each with table_exists? — some tables may have been dropped by earlier migrations
    remove_column :job_plans, :plan_type_id, if_exists: true if table_exists?(:job_plans)
    remove_column :job_plan_tabs, :plan_category_id, if_exists: true if table_exists?(:job_plan_tabs)
    remove_column :sm_schedule_masters, :plan_type_ids, if_exists: true if table_exists?(:sm_schedule_masters)
    remove_column :sm_template_rows, :plan_type_ids, if_exists: true if table_exists?(:sm_template_rows)
    remove_column :sm_tasks, :plan_type_ids, if_exists: true if table_exists?(:sm_tasks)

    # 3. Drop all legacy plan tables (order matters for FKs)
    drop_table :plan_identification_rules, if_exists: true
    drop_table :plan_identifications, if_exists: true
    drop_table :plan_category_plan_types, if_exists: true
    drop_table :plan_folder_scans, if_exists: true
    drop_table :plan_reextractions, if_exists: true
    drop_table :plan_uploads, if_exists: true
    drop_table :plan_types, if_exists: true
    drop_table :plan_categories, if_exists: true
  end

  def down
    raise ActiveRecord::IrreversibleMigration, "Legacy plan tables have been removed. Use DocumentTypes instead."
  end
end
