class FixWarehouseFoldersUniqueConstraintIncludeParent < ActiveRecord::Migration[8.0]
  def up
    # The old constraints only checked (warehouse_type_id, name) and
    # (tenant_id, warehouse_type_id, name), preventing same-name folders
    # under different parents (e.g., root "Site" tab + "Site" sub-tab under Photo).
    # The Rails model validates uniqueness with scope [:tenant_id, :warehouse_type_id, :parent_id],
    # so the DB constraint should match.
    remove_index :warehouse_folders, name: :idx_warehouse_folders_unique_name, if_exists: true
    remove_index :warehouse_folders, name: :idx_wf_tenant_type_name, if_exists: true

    # New constraint: same name is OK under different parents (COALESCE handles NULL parent_id)
    execute <<~SQL
      CREATE UNIQUE INDEX idx_warehouse_folders_unique_name
      ON warehouse_folders (tenant_id, warehouse_type_id, COALESCE(parent_id, 0), name)
    SQL
  end

  def down
    execute "DROP INDEX IF EXISTS idx_warehouse_folders_unique_name"

    add_index :warehouse_folders, [:warehouse_type_id, :name],
              unique: true, name: :idx_warehouse_folders_unique_name
    add_index :warehouse_folders, [:tenant_id, :warehouse_type_id, :name],
              unique: true, name: :idx_wf_tenant_type_name
  end
end
