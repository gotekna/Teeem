# frozen_string_literal: true

# LIM: Remove redundant warehouse_folder_templates column
#
# SSoT Architecture (simplified):
#   - warehouse_root_folders: Full path pattern including identifier
#   - EntityTab.folder_path: Document type folder (for scopes with tabs)
#
# Path Resolution:
#   If has_tabs (job, contact, corporate):
#     path = warehouse_root_folders[scope] + "/" + EntityTab.folder_path
#     Example: "Jobs/{{JobCode}}" + "Plans" → "Jobs/JOB-001/Plans"
#
#   If no_tabs (email, task):
#     path = warehouse_root_folders[scope]
#     Example: "Emails/{{Mailbox}}/{{Year}}/{{Month}}" → "Emails/inbox/2026/01"
#
# Before: 2 columns (redundant)
#   warehouse_root_folders:     { job: "Jobs" }
#   warehouse_folder_templates: { job: "{{JobCode}}/{{TabName}}" }
#
# After: 1 column (SSoT)
#   warehouse_root_folders: { job: "Jobs/{{JobCode}}", email: "Emails/{{Mailbox}}/{{Year}}/{{Month}}" }
#
class RemoveWarehouseFolderTemplates < ActiveRecord::Migration[7.1]
  def up
    # Step 1: Migrate identifier patterns from templates into root_folders
    # For scopes WITH tabs: add identifier to root (tabs provide the final folder)
    # For scopes WITHOUT tabs: use full path pattern
    execute <<-SQL
      UPDATE storage_configurations
      SET warehouse_root_folders = jsonb_build_object(
        'job', 'Jobs/{{JobCode}}',
        'contact', 'Contacts/{{ContactName}}',
        'corporate_entity', 'Corporate/{{CompanyGroup}}/{{CompanyCode}}',
        'people', 'People/{{ContactName}}',
        'task', 'Tasks/{{TaskId}}',
        'email', 'Emails/{{Mailbox}}/{{Year}}/{{Month}}',
        'warehouse', 'Warehousing/{{UserName}}/{{Year}}'
      )
    SQL

    # Step 2: Drop the redundant column
    remove_column :storage_configurations, :warehouse_folder_templates
  end

  def down
    # Re-add the column
    add_column :storage_configurations, :warehouse_folder_templates, :jsonb, default: {}, null: false

    # Restore original structure (extract identifier back to templates)
    execute <<-SQL
      UPDATE storage_configurations
      SET warehouse_folder_templates = '{
        "job": "{{JobCode}}/{{TabName}}",
        "contact": "{{ContactName}}/{{TabName}}",
        "corporate_entity": "{{CompanyGroup}}/{{CompanyCode}}/{{TabName}}",
        "corporate": "{{CompanyGroup}}/{{CompanyCode}}/{{TabName}}",
        "people": "{{ContactName}}/{{TabName}}",
        "task": "{{TaskId}}",
        "email": "{{Year}}/{{Month}}",
        "warehouse": "{{UserName}}/{{Year}}"
      }'::jsonb,
      warehouse_root_folders = '{
        "job": "Jobs",
        "contact": "Contacts",
        "corporate_entity": "Corporate",
        "people": "People",
        "task": "Tasks",
        "email": "Emails/{{Mailbox}}",
        "warehouse": "Warehousing"
      }'::jsonb
    SQL
  end
end
