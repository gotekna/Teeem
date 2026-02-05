# frozen_string_literal: true

# Migration: Fix warehouse types hierarchy
#
# Problem: The initial seed migration put 39 entries in warehouse_types including
# sub-types like email_body, email_attachments which should actually be base_folders.
#
# Solution:
# 1. Keep only 13 main warehouse types (job, contact, corporate, email, task, case,
#    asset, document, template, user, warehouse, compliance, payment)
# 2. Move sub-types to base_folders table, linked to their parent warehouse_type
# 3. Delete the sub-types from warehouse_types
#
# Correct Hierarchy:
#   Warehouse Types (13 main types - TOP of tree)
#       └── Base Folders (sub-types linked to parent)
#               └── Warehouse Folders (tabs)
#
class FixWarehouseTypesHierarchy < ActiveRecord::Migration[7.2]
  def up
    # Define the 13 main warehouse types to keep
    main_types = %w[job contact corporate email task case asset document template user warehouse compliance payment]

    # Define sub-types and their parent mappings
    # Key = sub-type code (to move from warehouse_types to base_folders)
    # Value = parent warehouse_type code
    sub_type_mappings = {
      "email_body" => "email",
      "email_attachments" => "email",
      "task_attachments" => "task",
      "task_responses" => "task",
      "case_documents" => "case",
      "case_emails" => "case",
      "asset_expenses" => "asset",
      "asset_service" => "asset",
      "asset_readings" => "asset",
      "financial" => "corporate",
      "financial_transactions" => "corporate",
      "bank_statement" => "corporate",
      "balance_sheet" => "corporate",
      "template_documents" => "template",
      "template_bank_statements" => "template",
      "template_invoices" => "template",
      "template_email_signatures" => "template",
      "template_pdf_fields" => "template",
      "payment_invoices" => "payment",
      "payment_proof" => "payment",
      "esignature" => "document",
      "esignature_pending" => "document",
      "esignature_completed" => "document",
      "plan" => "document",
      "notebook" => "document",
      "xero" => "corporate"
    }

    # Track stats
    created_count = 0
    deleted_count = 0

    # For each sub-type currently in warehouse_types:
    # 1. Find the sub-type and parent type
    # 2. Create a base_folder with same name, linked to parent
    # 3. Delete the sub-type from warehouse_types
    sub_type_mappings.each do |sub_code, parent_code|
      # Get the sub-type and parent type IDs and details
      sub_type_result = execute(<<-SQL.squish)
        SELECT id, display_name, icon_name, is_system, enabled, order_position
        FROM warehouse_types
        WHERE code = '#{sub_code}'
      SQL

      parent_type_result = execute(<<-SQL.squish)
        SELECT id FROM warehouse_types WHERE code = '#{parent_code}'
      SQL

      next if sub_type_result.count.zero? || parent_type_result.count.zero?

      sub_type = sub_type_result.first
      parent_id = parent_type_result.first["id"]

      # Create base_folder from the sub_type
      # Use the display_name as the folder name
      folder_name = sub_type["display_name"]

      # Build a reasonable folder_path_template based on the sub_code
      folder_path_template = sub_code.titleize

      # Check if base_folder already exists (avoid duplicates)
      existing = execute(<<-SQL.squish)
        SELECT id FROM base_folders
        WHERE warehouse_type_id = #{parent_id} AND name = '#{folder_name}'
      SQL

      if existing.count.zero?
        # Create the base_folder
        execute(<<-SQL.squish)
          INSERT INTO base_folders (
            warehouse_type_id,
            name,
            folder_path_template,
            is_system,
            enabled,
            order_position,
            created_at,
            updated_at
          )
          VALUES (
            #{parent_id},
            '#{folder_name}',
            '#{folder_path_template}',
            #{sub_type["is_system"] || false},
            #{sub_type["enabled"] != false},
            #{sub_type["order_position"] || 0},
            NOW(),
            NOW()
          )
        SQL
        created_count += 1
      end

      # Delete the sub_type from warehouse_types
      execute("DELETE FROM warehouse_types WHERE id = #{sub_type["id"]}")
      deleted_count += 1
    end

    puts "[FixWarehouseTypesHierarchy] Created #{created_count} base folders from sub-types"
    puts "[FixWarehouseTypesHierarchy] Deleted #{deleted_count} sub-types from warehouse_types"

    # Verify final counts
    wt_count = execute("SELECT COUNT(*) FROM warehouse_types").first["count"]
    bf_count = execute("SELECT COUNT(*) FROM base_folders").first["count"]
    puts "[FixWarehouseTypesHierarchy] Final warehouse_types count: #{wt_count} (expected: 13)"
    puts "[FixWarehouseTypesHierarchy] Final base_folders count: #{bf_count}"
  end

  def down
    # This migration restructures data significantly
    # Reversing would require recreating warehouse_types from base_folders
    # which loses information (icon_name, etc.) and could cause issues
    raise ActiveRecord::IrreversibleMigration, "Cannot reverse hierarchy restructuring - would lose data"
  end
end
