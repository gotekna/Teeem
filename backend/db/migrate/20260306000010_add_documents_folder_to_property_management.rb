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

    WarehouseFolder.create!(
      warehouse_type: wt,
      parent: root,
      tenant_id: root.tenant_id, # Match root's tenant scope (nil for global)
      name: "Documents",
      display_name: "General Documents",
      folder_segment: "Documents",
      tab_key: "documents",
      tab_type: "document",
      tab_group: "documents",
      icon_name: "FileText",
      order_position: 10,
      enabled: true,
      is_system: true,
      warehouse_enabled: true
    )

    say "Created 'Documents' folder for Property Management"
  end

  def down
    wt = WarehouseType.find_by(code: "property")
    return unless wt

    WarehouseFolder.unscoped.where(warehouse_type_id: wt.id, tab_key: "documents").destroy_all
  end
end
