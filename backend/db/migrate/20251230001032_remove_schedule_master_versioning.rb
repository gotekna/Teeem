# Remove Schedule Master versioning system
# This simplifies the template system by removing draft/published/archived workflow
#
# Tables/columns removed:
# - sm_schedule_master_versions table (entire table)
# - sm_schedule_masters.sm_schedule_master_version_id
# - jobs.sm_template_version_id
#
class RemoveScheduleMasterVersioning < ActiveRecord::Migration[8.0]
  def up
    # Remove foreign keys first (must be done before removing columns/tables)
    if foreign_key_exists?(:jobs, :sm_schedule_master_versions, column: :sm_template_version_id)
      remove_foreign_key :jobs, :sm_schedule_master_versions, column: :sm_template_version_id
    end

    if foreign_key_exists?(:sm_schedule_masters, :sm_schedule_master_versions)
      remove_foreign_key :sm_schedule_masters, :sm_schedule_master_versions
    end

    # Remove indexes
    if index_exists?(:jobs, :sm_template_version_id, name: "idx_jobs_template_version")
      remove_index :jobs, name: "idx_jobs_template_version"
    end

    if index_exists?(:sm_schedule_masters, :sm_schedule_master_version_id, name: "idx_sm_rows_version")
      remove_index :sm_schedule_masters, name: "idx_sm_rows_version"
    end

    # Remove columns from tables
    if column_exists?(:jobs, :sm_template_version_id)
      remove_column :jobs, :sm_template_version_id
    end

    if column_exists?(:sm_schedule_masters, :sm_schedule_master_version_id)
      remove_column :sm_schedule_masters, :sm_schedule_master_version_id
    end

    # Drop the versioning table entirely
    drop_table :sm_schedule_master_versions, if_exists: true
  end

  def down
    # This migration is irreversible - version data is deleted
    raise ActiveRecord::IrreversibleMigration, "Cannot restore deleted versioning data"
  end
end
