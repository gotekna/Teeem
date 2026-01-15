# frozen_string_literal: true

# SSoT Consolidation: Remove duplicate root_path columns
#
# BEFORE: Three different root_path values:
#   1. CorporateCompanySetting.sharepoint_root_path = "/Shared Documents"
#   2. S3CompatibleCredential.root_path = "" (empty)
#   3. StorageConfiguration.root_path = "/Shared Documents"
#
# AFTER: ONE root_path in StorageConfiguration (THE ONE SSoT)
#
class ConsolidateRootPathToStorageConfiguration < ActiveRecord::Migration[8.0]
  def up
    # 1. Copy any non-empty S3 credential root_path values to StorageConfiguration
    # (safety: preserve any intentional configuration before removing columns)
    if table_exists?(:s3_compatible_credentials) && column_exists?(:s3_compatible_credentials, :root_path)
      execute <<-SQL.squish
        UPDATE storage_configurations sc
        SET root_path = s3.root_path
        FROM s3_compatible_credentials s3
        WHERE s3.organization_id = sc.organization_id
          AND s3.root_path IS NOT NULL
          AND s3.root_path != ''
          AND sc.root_path = '/Shared Documents'
      SQL
    end

    # 2. Remove duplicate columns (SSoT cleanup)
    if column_exists?(:s3_compatible_credentials, :root_path)
      remove_column :s3_compatible_credentials, :root_path
    end

    if column_exists?(:corporate_company_settings, :sharepoint_root_path)
      remove_column :corporate_company_settings, :sharepoint_root_path
    end

    Rails.logger.info "[SSoT] Consolidated root_path to StorageConfiguration - deleted duplicate columns"
  end

  def down
    # Restore columns (but data is lost)
    unless column_exists?(:s3_compatible_credentials, :root_path)
      add_column :s3_compatible_credentials, :root_path, :string, default: ""
    end

    unless column_exists?(:corporate_company_settings, :sharepoint_root_path)
      add_column :corporate_company_settings, :sharepoint_root_path, :string, default: "/Shared Documents"
    end
  end
end
