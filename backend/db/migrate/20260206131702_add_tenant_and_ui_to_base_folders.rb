# frozen_string_literal: true

# Migration: Add tenant_id and UI columns to base_folders
#
# Part of "Eliminate warehouse_folders, Make base_folders Tenant-Specific" refactor.
# This adds tenant scoping and all UI configuration columns that were previously
# duplicated in warehouse_folders.
#
# Key changes:
# - tenant_id: Required for multi-tenancy
# - folder_segment: Renamed from folder_path_template (stores ONLY this folder's segment)
# - folder_path_suffix: User-added customization tokens
# - All UI columns migrated from warehouse_folders (icon, display_mode, templates, etc.)
#
# Path Computation (NOT stored, computed at runtime):
#   warehouse_type.folder_path_template + parent_chain_segments + folder_segment + folder_path_suffix
#   = "Job/{{JobCode}}/{{JobName}}" + "/Photo" + "/Supervisor" + "/{{Date}}"
#
class AddTenantAndUiToBaseFolders < ActiveRecord::Migration[7.2]
  def change
    # Tenant scoping - REQUIRED for all base_folders
    add_reference :base_folders, :tenant, foreign_key: true, null: true

    # SSoT: Rename folder_path_template to folder_segment (only this folder's part)
    # Full path is computed: warehouse_type.folder_path_template + ancestors + segment + suffix
    rename_column :base_folders, :folder_path_template, :folder_segment

    # User-added suffix (dynamic tokens like {{Date}})
    add_column :base_folders, :folder_path_suffix, :string

    # Tab identification (from warehouse_folders)
    add_column :base_folders, :tab_key, :string
    add_column :base_folders, :display_name, :string
    add_column :base_folders, :display_code, :string, limit: 3
    add_column :base_folders, :description, :text

    # Tab grouping and ordering
    add_column :base_folders, :tab_group, :string, default: 'documents'

    # UI display settings
    add_column :base_folders, :icon_name, :string
    add_column :base_folders, :display_mode, :string, default: 'both'
    add_column :base_folders, :hidden_by_default, :boolean, default: false
    add_column :base_folders, :component_name, :string

    # Warehouse integration
    add_column :base_folders, :warehouse_enabled, :boolean, default: true
    add_column :base_folders, :is_photo_category, :boolean, default: false
    add_column :base_folders, :is_cad_category, :boolean, default: false

    # Visibility and filtering
    add_column :base_folders, :visibility_rule, :string
    add_column :base_folders, :xero_scope, :string
    add_column :base_folders, :entity_filters, :string, array: true, default: []
    add_column :base_folders, :warehouse_type_override, :string

    # Template columns (for document naming)
    add_column :base_folders, :ui_name_template, :string
    add_column :base_folders, :download_name_template, :string

    # Job-specific folders (job_id: null = global template, job_id: X = job-specific override)
    add_reference :base_folders, :job, foreign_key: true, null: true

    # Legacy columns (for migration compatibility)
    add_column :base_folders, :uses_custom_path, :boolean, default: false
    add_column :base_folders, :is_system_tab, :boolean, default: false

    # Indexes for common queries
    add_index :base_folders, :tenant_id, name: 'idx_bf_tenant'
    add_index :base_folders, [:tenant_id, :warehouse_type_id, :name],
              unique: true, name: 'idx_bf_tenant_type_name',
              where: 'tenant_id IS NOT NULL'
    add_index :base_folders, :tab_key
    add_index :base_folders, :tab_group
    add_index :base_folders, :warehouse_enabled
    add_index :base_folders, :entity_filters, using: :gin
  end
end
