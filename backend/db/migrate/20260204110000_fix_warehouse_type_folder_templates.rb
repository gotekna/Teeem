# frozen_string_literal: true

# Migration: Fix warehouse_type folder_path_templates and normalize base_folder paths
#
# FRC (Feb 2026): The original seed migration had INCONSISTENT data:
# - Some base_folders had full paths (e.g., "Assets/{{AssetCode}}")
# - Others had relative paths (e.g., "Asset Service")
# - warehouse_types had NO folder_path_template set (all NULL)
#
# SSoT Design:
# - warehouse_type.folder_path_template = root template for the scope
# - base_folder.folder_path_template = relative path from root (or full path for override)
#
# The API (warehouse_types_controller.rb) now computes full_path_template by:
# 1. If base_folder template is blank → use warehouse_type template
# 2. If base_folder template starts with scope root → use as-is (full path)
# 3. If base_folder template is relative → prepend warehouse_type template
#
class FixWarehouseTypeFolderTemplates < ActiveRecord::Migration[7.2]
  def up
    # ═══════════════════════════════════════════════════════════════════════════
    # STEP 1: Set folder_path_template on warehouse_types
    # This defines the root template for each scope
    # ═══════════════════════════════════════════════════════════════════════════
    warehouse_type_templates = {
      "job" => "Jobs/{{JobCode}}",
      "contact" => "Contacts/{{ContactName}}",
      "corporate" => "Corporate/{{CompanyGroup}}/{{CompanyCode}}",
      "email" => "Emails/{{Mailbox}}/{{Year}}/{{Month}}",
      "task" => "Tasks/{{TaskId}}/{{TaskName}}",
      "case" => "Cases/{{CaseId}}/{{CaseName}}",
      "asset" => "Asset",
      "document" => "Documents",
      "template" => "Templates",
      "user" => "Teeem Docs/{{UserName}}",
      "warehouse" => "Warehousing",
      "compliance" => "Compliance",
      "payment" => "Payments"
    }

    warehouse_type_templates.each do |code, template|
      execute(<<-SQL.squish)
        UPDATE warehouse_types
        SET folder_path_template = '#{template}'
        WHERE code = '#{code}'
          AND (folder_path_template IS NULL OR folder_path_template = '')
      SQL
    end

    # ═══════════════════════════════════════════════════════════════════════════
    # STEP 2: Normalize base_folder paths to be relative where appropriate
    # If a base_folder path starts with its warehouse_type's root, make it relative
    # ═══════════════════════════════════════════════════════════════════════════

    # For Asset type: "Asset Expenses" → "Expenses", "Asset Service" → "Service", etc.
    # But keep "Assets/{{AssetCode}}" as-is since it's the main category
    normalize_mappings = [
      # Asset type (id 7 typically, but use subquery to be safe)
      { type: "asset", old_path: "Asset Expenses", new_path: "Expenses" },
      { type: "asset", old_path: "Asset Service", new_path: "Service" },
      { type: "asset", old_path: "Asset Readings", new_path: "Readings" },
      # Note: "Assets/{{AssetCode}}" stays as full path - it's the root category

      # Task type - normalize relative paths
      { type: "task", old_path: "Task Attachments", new_path: "Attachments" },
      { type: "task", old_path: "Task Responses", new_path: "Responses" },

      # Case type - normalize relative paths
      { type: "case", old_path: "Case Documents", new_path: "Documents" },
      { type: "case", old_path: "Case Emails", new_path: "Emails" },

      # Email type - normalize relative paths
      { type: "email", old_path: "Email Body", new_path: "Body" },
      { type: "email", old_path: "Email Attachments", new_path: "Attachments" },

      # Corporate type - normalize relative paths
      { type: "corporate", old_path: "Financial", new_path: "Financial" },
      { type: "corporate", old_path: "Financial Transactions", new_path: "Financial Transactions" },
      { type: "corporate", old_path: "Bank Statement", new_path: "Bank Statement" },
      { type: "corporate", old_path: "Balance Sheet", new_path: "Balance Sheet" },
      { type: "corporate", old_path: "Xero", new_path: "Xero" },

      # Document type - normalize
      { type: "document", old_path: "E-Signature", new_path: "E-Signature" },
      { type: "document", old_path: "E-Signature Pending", new_path: "E-Signature Pending" },
      { type: "document", old_path: "E-Signature Completed", new_path: "E-Signature Completed" },
      { type: "document", old_path: "Plan", new_path: "Plan" },
      { type: "document", old_path: "Notebook", new_path: "Notebook" },

      # Template type - normalize
      { type: "template", old_path: "Template Documents", new_path: "Documents" },
      { type: "template", old_path: "Template Bank Statements", new_path: "Bank Statements" },
      { type: "template", old_path: "Template Invoices", new_path: "Invoices" },
      { type: "template", old_path: "Template Email Signatures", new_path: "Email Signatures" },
      { type: "template", old_path: "Template PDF Fields", new_path: "PDF Fields" },

      # Payment type - normalize
      { type: "payment", old_path: "Payment Invoices", new_path: "Invoices" },
      { type: "payment", old_path: "Payment Proof", new_path: "Proof" }
    ]

    normalize_mappings.each do |mapping|
      execute(<<-SQL.squish)
        UPDATE base_folders bf
        SET folder_path_template = '#{mapping[:new_path]}'
        FROM warehouse_types wt
        WHERE bf.warehouse_type_id = wt.id
          AND wt.code = '#{mapping[:type]}'
          AND bf.folder_path_template = '#{mapping[:old_path]}'
      SQL
    end

    puts "[FixWarehouseTypeFolderTemplates] Updated warehouse_type folder_path_templates"
    puts "[FixWarehouseTypeFolderTemplates] Normalized base_folder paths to be relative"
  end

  def down
    # Clear the folder_path_template on warehouse_types
    execute("UPDATE warehouse_types SET folder_path_template = NULL")

    # Note: We don't reverse the base_folder normalization as it would require
    # storing the original values. The system handles both formats now.
  end
end
