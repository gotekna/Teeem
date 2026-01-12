# frozen_string_literal: true

class AddSystemManagedEntityTabs < ActiveRecord::Migration[8.0]
  def up
    # Add system-managed EntityTabs for Email and Warehousing
    # These are read-only in Entity Configurator (users can see but not edit paths)
    # SSoT: All storage paths should be visible in Entity Configurator

    # 1. Email scope - for email EML storage
    # Path: emails/eml/{{OrgName}}/{{Year}}/{{Month}}
    unless EntityTab.exists?(scope: "email", tab_key: "email_storage")
      EntityTab.create!(
        scope: "email",
        tab_key: "email_storage",
        display_name: "Email Storage",
        tab_group: "system",
        icon_name: "mail",
        enabled: true,
        is_system_tab: true,  # Read-only in UI
        has_storage_folder: true,
        storage_folder_path: "emails/eml/{{OrgName}}/{{Year}}/{{Month}}",
        description: "System storage for email EML files. Organized by organization, year, and month.",
        order_position: 1
      )
    end

    # 2. Warehousing scope - parent folder for system files
    unless EntityTab.exists?(scope: "warehouse", tab_key: "warehouse_root")
      warehouse_tab = EntityTab.create!(
        scope: "warehouse",
        tab_key: "warehouse_root",
        display_name: "Warehousing",
        tab_group: "system",
        icon_name: "warehouse",
        enabled: true,
        is_system_tab: true,
        has_storage_folder: true,
        storage_folder_path: "Warehousing",
        description: "System storage for price book photos, templates, and other system files.",
        order_position: 2
      )

      # 2a. Pricebook Photos - child of Warehousing
      EntityTab.create!(
        scope: "warehouse",
        tab_key: "pricebook_photos",
        display_name: "Pricebook Photos",
        tab_group: "system",
        parent_id: warehouse_tab.id,
        icon_name: "image",
        enabled: true,
        is_system_tab: true,
        has_storage_folder: true,
        storage_folder_path: "Pricebook Photos",
        description: "Photos and QR codes for price book items.",
        order_position: 1
      )

      # 2b. Templates - child of Warehousing
      EntityTab.create!(
        scope: "warehouse",
        tab_key: "templates",
        display_name: "Templates",
        tab_group: "system",
        parent_id: warehouse_tab.id,
        icon_name: "file-text",
        enabled: true,
        is_system_tab: true,
        has_storage_folder: true,
        storage_folder_path: "Templates",
        description: "Document templates for proposals, invoices, etc.",
        order_position: 2
      )
    end
  end

  def down
    EntityTab.where(scope: ["email", "warehouse"]).destroy_all
  end
end
