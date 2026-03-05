class AddDocumentsFolderToPropertyManagement < ActiveRecord::Migration[8.0]
  def up
    # Add a general "Documents" sub-folder to the Property Management warehouse type.
    # This gives property detail pages a general-purpose documents tab
    # alongside the specific ones (Contracts, Insurance, etc.)

    wt = WarehouseType.find_by(code: "property")
    return unless wt

    root = WarehouseFolder.unscoped.find_by(warehouse_type_id: wt.id, tab_key: "properties")
    return unless root

    # Check if already exists (idempotent)
    return if WarehouseFolder.unscoped.exists?(warehouse_type_id: wt.id, tab_key: "documents")

    # Use raw SQL to bypass GlobalConfigRecord validation that rejects
    # tenant_id=NULL records even with acts_as_tenant.without_tenant
    now = Time.current.iso8601
    execute <<-SQL
      INSERT INTO warehouse_folders (
        warehouse_type_id, parent_id, tenant_id,
        name, display_name, folder_segment,
        tab_key, tab_type, tab_group, icon_name,
        order_position, enabled, is_system, warehouse_enabled,
        created_at, updated_at
      ) VALUES (
        #{wt.id}, #{root.id}, NULL,
        'Documents', 'General Documents', 'Documents',
        'documents', 'document', 'documents', 'FileText',
        10, true, true, true,
        '#{now}', '#{now}'
      )
    SQL

    say "Created 'Documents' folder for Property Management"
  end

  def down
    wt = WarehouseType.find_by(code: "property")
    return unless wt

    WarehouseFolder.unscoped.where(warehouse_type_id: wt.id, tab_key: "documents").destroy_all
  end
end
