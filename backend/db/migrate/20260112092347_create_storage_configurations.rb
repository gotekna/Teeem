# frozen_string_literal: true

# SSoT: StorageConfiguration is THE ONE place for all document storage configuration
#
# This consolidates storage config that was previously scattered across:
# - CorporateCompanySetting (sharepoint_* columns)
# - MicrosoftCredential (sharepoint_site_id, sharepoint_drive_id)
# - Organization (document_provider)
#
# Benefits:
# - Provider-agnostic (works with SharePoint, S3, Wasabi, local)
# - Single place for all path configuration
# - Single resolve_path() method for all entities
# - Credentials only hold auth tokens, not config
#
class CreateStorageConfigurations < ActiveRecord::Migration[7.2]
  def change
    create_table :storage_configurations do |t|
      # Organization ownership (required for multi-tenant)
      t.references :organization, null: false, foreign_key: true, index: { unique: true }

      # Provider type - what storage backend to use
      t.string :provider_type, null: false, default: "sharepoint"
      t.string :status, null: false, default: "disconnected"

      # Provider-specific connection config (stored as JSON for flexibility)
      # SharePoint: { site_id, drive_id, site_url, drive_name }
      # S3/Wasabi: { endpoint, bucket, region }
      # Local: { base_directory }
      t.jsonb :connection_config, null: false, default: {}

      # Root path prefix (provider-agnostic)
      t.string :root_path, null: false, default: "/Shared Documents"

      # Base paths for each document scope (provider-agnostic)
      # These are relative to root_path
      t.jsonb :paths, null: false, default: {
        "jobs" => "Jobs",
        "corporate" => "Corporate",
        "people" => "People",
        "contacts" => "Contacts",
        "tasks" => "Tasks",
        "accounts" => "Accounts",
        "emails" => "Emails"
      }

      # Path templates with placeholders (provider-agnostic)
      # Placeholders: {{JobCode}}, {{ContactName}}, {{Category}}, {{CompanyGroup}}, etc.
      t.jsonb :templates, null: false, default: {
        "job" => "{{JobCode}}/{{Category}}",
        "corporate" => "{{CompanyGroup}}/{{CompanyCode}}/{{Folder}}",
        "people" => "{{ContactName}}/{{Category}}",
        "contacts" => "{{ContactName}}/{{Category}}",
        "task" => "Task-{{TaskId}}/{{Category}}",
        "account" => "{{Source}}/{{ContactName}}/{{Category}}"
      }

      # Polymorphic reference to credential (MicrosoftCredential or S3CompatibleCredential)
      t.references :credential, polymorphic: true, index: true

      t.timestamps
    end

    # Migrate existing data from CorporateCompanySetting
    reversible do |dir|
      dir.up do
        execute <<~SQL
          INSERT INTO storage_configurations (
            organization_id,
            provider_type,
            status,
            connection_config,
            root_path,
            paths,
            templates,
            created_at,
            updated_at
          )
          SELECT
            o.id,
            COALESCE(o.document_provider, 'sharepoint'),
            CASE
              WHEN ccs.sharepoint_site_id IS NOT NULL AND ccs.sharepoint_drive_id IS NOT NULL THEN 'connected'
              ELSE 'disconnected'
            END,
            jsonb_build_object(
              'site_id', ccs.sharepoint_site_id,
              'drive_id', ccs.sharepoint_drive_id,
              'site_url', ccs.sharepoint_site_url,
              'drive_name', ccs.sharepoint_drive_name
            ),
            COALESCE(ccs.sharepoint_root_path, '/Shared Documents'),
            jsonb_build_object(
              'jobs', COALESCE(ccs.sharepoint_jobs_path, 'Jobs'),
              'corporate', COALESCE(ccs.sharepoint_company_path, 'Corporate'),
              'people', COALESCE(ccs.sharepoint_people_path, 'People'),
              'contacts', COALESCE(ccs.sharepoint_contacts_path, 'Contacts'),
              'tasks', COALESCE(ccs.sharepoint_tasks_path, 'Tasks'),
              'accounts', 'Accounts',
              'emails', 'Emails'
            ),
            jsonb_build_object(
              'job', COALESCE(ccs.sharepoint_job_template, '{{JobCode}}/{{Category}}'),
              'corporate', COALESCE(ccs.sharepoint_company_template, '{{CompanyGroup}}/{{CompanyCode}}/{{Folder}}'),
              'people', COALESCE(ccs.sharepoint_people_template, '{{ContactName}}/{{Category}}'),
              'contacts', COALESCE(ccs.sharepoint_contacts_template, '{{ContactName}}/{{Category}}'),
              'task', COALESCE(ccs.sharepoint_task_template, 'Task-{{TaskId}}/{{Category}}'),
              'account', '{{Source}}/{{ContactName}}/{{Category}}'
            ),
            NOW(),
            NOW()
          FROM organizations o
          CROSS JOIN corporate_company_settings ccs
          LIMIT 1
        SQL
      end
    end
  end
end
