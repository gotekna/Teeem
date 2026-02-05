# frozen_string_literal: true

# Migration: Seed warehouse_types and base_folders from existing data
#
# This data migration:
# 1. Creates 13 main WarehouseType records (the top of the hierarchy)
# 2. Creates BaseFolder records for each warehouse_type (including sub-types)
# 3. Populates base_folder_id on existing warehouse_folders
#
# Hierarchy:
#   Warehouse Types (13 main types - TOP of tree)
#       └── Base Folders (folders/sub-types linked to parent)
#               └── Warehouse Folders (tabs)
#
# Reversible: Clears the seeded data on rollback.
#
class SeedWarehouseTypesAndBaseFolders < ActiveRecord::Migration[7.2]
  def up
    # ═══════════════════════════════════════════════════════════════════════════
    # STEP 1: Create the 13 main WarehouseType records
    # These are the TOP of the hierarchy - the main categories
    # ═══════════════════════════════════════════════════════════════════════════
    warehouse_type_definitions = [
      { code: "job", display_name: "Job", icon_name: "Briefcase", order: 1 },
      { code: "contact", display_name: "Contact", icon_name: "Users", order: 2 },
      { code: "corporate", display_name: "Corporate", icon_name: "Building2", order: 3 },
      { code: "email", display_name: "Email", icon_name: "Mail", order: 4 },
      { code: "task", display_name: "Task", icon_name: "CheckSquare", order: 5 },
      { code: "case", display_name: "Case", icon_name: "FileBox", order: 6 },
      { code: "asset", display_name: "Asset", icon_name: "Package", order: 7 },
      { code: "document", display_name: "Document", icon_name: "FileText", order: 8 },
      { code: "template", display_name: "Template", icon_name: "LayoutTemplate", order: 9 },
      { code: "user", display_name: "User", icon_name: "User", order: 10 },
      { code: "warehouse", display_name: "Warehouse", icon_name: "Warehouse", order: 11, is_system: true },
      { code: "compliance", display_name: "Compliance", icon_name: "Shield", order: 12 },
      { code: "payment", display_name: "Payment", icon_name: "CreditCard", order: 13 }
    ]

    warehouse_type_ids = {}
    warehouse_type_definitions.each do |definition|
      result = execute(<<-SQL.squish)
        INSERT INTO warehouse_types (code, display_name, icon_name, is_system, enabled, order_position, created_at, updated_at)
        VALUES (
          '#{definition[:code]}',
          '#{definition[:display_name]}',
          #{definition[:icon_name] ? "'#{definition[:icon_name]}'" : 'NULL'},
          #{definition[:is_system] ? 'TRUE' : 'FALSE'},
          TRUE,
          #{definition[:order]},
          NOW(),
          NOW()
        )
        ON CONFLICT (code) DO UPDATE SET display_name = EXCLUDED.display_name
        RETURNING id
      SQL
      warehouse_type_ids[definition[:code]] = result.first["id"]
    end

    # ═══════════════════════════════════════════════════════════════════════════
    # STEP 2: Create BaseFolder records
    # Each warehouse_type has one or more base folders (including sub-types)
    # ═══════════════════════════════════════════════════════════════════════════
    base_folder_definitions = [
      # Job folders
      { type: "job", name: "Jobs", folder_path_template: "Jobs/{{JobCode}}", is_system: true, order: 1 },

      # Contact folders
      { type: "contact", name: "Contacts", folder_path_template: "Contacts/{{ContactName}}", is_system: true, order: 1 },

      # Corporate folders
      { type: "corporate", name: "Corporate", folder_path_template: "Corporate/{{CompanyGroup}}/{{CompanyCode}}", is_system: true, order: 1 },
      { type: "corporate", name: "Financial", folder_path_template: "Financial", is_system: true, order: 2 },
      { type: "corporate", name: "Financial Transactions", folder_path_template: "Financial Transactions", is_system: true, order: 3 },
      { type: "corporate", name: "Bank Statement", folder_path_template: "Bank Statement", is_system: true, order: 4 },
      { type: "corporate", name: "Balance Sheet", folder_path_template: "Balance Sheet", is_system: true, order: 5 },
      { type: "corporate", name: "Xero", folder_path_template: "Xero", is_system: true, order: 6 },

      # Email folders
      { type: "email", name: "Emails", folder_path_template: "Emails/{{Mailbox}}/{{Year}}/{{Month}}", download_name_template: "{Subject} - {Date}.eml", ui_name_template: "{Subject}", is_system: true, order: 1 },
      { type: "email", name: "Email Body", folder_path_template: "Email Body", is_system: true, order: 2 },
      { type: "email", name: "Email Attachments", folder_path_template: "Email Attachments", is_system: true, order: 3 },

      # Task folders
      { type: "task", name: "Tasks", folder_path_template: "Tasks/{{TaskId}}/{{TaskName}}", is_system: true, order: 1 },
      { type: "task", name: "Task Attachments", folder_path_template: "Task Attachments", is_system: true, order: 2 },
      { type: "task", name: "Task Responses", folder_path_template: "Task Responses", is_system: true, order: 3 },

      # Case folders
      { type: "case", name: "Cases", folder_path_template: "Cases/{{CaseId}}/{{CaseName}}", is_system: true, order: 1 },
      { type: "case", name: "Case Documents", folder_path_template: "Case Documents", is_system: true, order: 2 },
      { type: "case", name: "Case Emails", folder_path_template: "Case Emails", is_system: true, order: 3 },

      # Asset folders
      { type: "asset", name: "Assets", folder_path_template: "Assets/{{AssetCode}}", is_system: true, order: 1 },
      { type: "asset", name: "Asset Expenses", folder_path_template: "Asset Expenses", is_system: true, order: 2 },
      { type: "asset", name: "Asset Service", folder_path_template: "Asset Service", is_system: true, order: 3 },
      { type: "asset", name: "Asset Readings", folder_path_template: "Asset Readings", is_system: true, order: 4 },

      # Document folders
      { type: "document", name: "Documents", folder_path_template: "Documents", is_system: true, order: 1 },
      { type: "document", name: "E-Signature", folder_path_template: "E-Signature", is_system: true, order: 2 },
      { type: "document", name: "E-Signature Pending", folder_path_template: "E-Signature Pending", is_system: true, order: 3 },
      { type: "document", name: "E-Signature Completed", folder_path_template: "E-Signature Completed", is_system: true, order: 4 },
      { type: "document", name: "Plan", folder_path_template: "Plan", is_system: true, order: 5 },
      { type: "document", name: "Notebook", folder_path_template: "Notebook", is_system: true, order: 6 },

      # Template folders
      { type: "template", name: "Templates", folder_path_template: "Templates", is_system: true, order: 1 },
      { type: "template", name: "Template Documents", folder_path_template: "Template Documents", is_system: true, order: 2 },
      { type: "template", name: "Template Bank Statements", folder_path_template: "Template Bank Statements", is_system: true, order: 3 },
      { type: "template", name: "Template Invoices", folder_path_template: "Template Invoices", is_system: true, order: 4 },
      { type: "template", name: "Template Email Signatures", folder_path_template: "Template Email Signatures", is_system: true, order: 5 },
      { type: "template", name: "Template PDF Fields", folder_path_template: "Template PDF Fields", is_system: true, order: 6 },

      # User folders
      { type: "user", name: "Teeem Docs", folder_path_template: "Teeem Docs/{{UserName}}", is_system: true, order: 1 },

      # Warehouse folders
      { type: "warehouse", name: "Warehousing", folder_path_template: "Warehousing", is_system: true, order: 1 },

      # Compliance folders
      { type: "compliance", name: "Compliance", folder_path_template: "Compliance", is_system: true, order: 1 },

      # Payment folders
      { type: "payment", name: "Payments", folder_path_template: "Payments", is_system: true, order: 1 },
      { type: "payment", name: "Payment Invoices", folder_path_template: "Payment Invoices", is_system: true, order: 2 },
      { type: "payment", name: "Payment Proof", folder_path_template: "Payment Proof", is_system: true, order: 3 }
    ]

    base_folder_ids = {}
    base_folder_definitions.each do |definition|
      wt_id = warehouse_type_ids[definition[:type]]
      next unless wt_id

      download_name = definition[:download_name_template] ? "'#{definition[:download_name_template]}'" : "NULL"
      ui_name = definition[:ui_name_template] ? "'#{definition[:ui_name_template]}'" : "NULL"

      result = execute(<<-SQL.squish)
        INSERT INTO base_folders (warehouse_type_id, name, folder_path_template, download_name_template, ui_name_template, is_system, enabled, order_position, created_at, updated_at)
        VALUES (
          #{wt_id},
          '#{definition[:name]}',
          '#{definition[:folder_path_template]}',
          #{download_name},
          #{ui_name},
          #{definition[:is_system] ? 'TRUE' : 'FALSE'},
          TRUE,
          #{definition[:order]},
          NOW(),
          NOW()
        )
        ON CONFLICT (warehouse_type_id, name) DO UPDATE SET folder_path_template = EXCLUDED.folder_path_template
        RETURNING id
      SQL
      # Store with type:name key for lookup
      base_folder_ids["#{definition[:type]}:#{definition[:name]}"] = result.first["id"]
    end

    # ═══════════════════════════════════════════════════════════════════════════
    # STEP 3: Populate base_folder_id on existing warehouse_folders
    # Match by warehouse_type column to find the primary base folder
    # ═══════════════════════════════════════════════════════════════════════════

    # Map warehouse_type strings to their primary base folder names
    primary_folder_names = {
      "job" => "Jobs",
      "contact" => "Contacts",
      "corporate" => "Corporate",
      "email" => "Emails",
      "task" => "Tasks",
      "case" => "Cases",
      "asset" => "Assets",
      "document" => "Documents",
      "template" => "Templates",
      "user" => "Teeem Docs",
      "warehouse" => "Warehousing",
      "compliance" => "Compliance",
      "payment" => "Payments"
    }

    primary_folder_names.each do |type_code, folder_name|
      bf_id = base_folder_ids["#{type_code}:#{folder_name}"]
      next unless bf_id

      execute(<<-SQL.squish)
        UPDATE warehouse_folders
        SET base_folder_id = #{bf_id}
        WHERE warehouse_type = '#{type_code}'
          AND base_folder_id IS NULL
      SQL
    end

    # Also try to match by base_folder column value
    execute(<<-SQL.squish)
      UPDATE warehouse_folders wf
      SET base_folder_id = bf.id
      FROM base_folders bf
      WHERE wf.base_folder = bf.name
        AND wf.base_folder_id IS NULL
    SQL

    puts "[SeedWarehouseTypesAndBaseFolders] Seeded #{warehouse_type_ids.count} warehouse types"
    puts "[SeedWarehouseTypesAndBaseFolders] Seeded #{base_folder_definitions.count} base folders"
  end

  def down
    # Clear the seeded data
    execute("UPDATE warehouse_folders SET base_folder_id = NULL")
    execute("DELETE FROM base_folders WHERE is_system = TRUE")
    execute("DELETE FROM warehouse_types")
  end
end
