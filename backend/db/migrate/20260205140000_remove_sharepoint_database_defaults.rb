# frozen_string_literal: true

# Migration: Remove hardcoded SharePoint defaults from database columns
#
# FRC (Feb 2026): Storage provider should be explicitly configured, not assumed.
# These columns previously defaulted to "sharepoint" which caused issues for
# organizations using S3/Wasabi storage.
#
# After this migration, these columns will have no default - the application
# code should explicitly set the provider based on actual configuration.
#
class RemoveSharepointDatabaseDefaults < ActiveRecord::Migration[8.0]
  def up
    # Remove default from organizations.document_provider
    change_column_default :organizations, :document_provider, from: "sharepoint", to: nil

    # Remove default from tenants.document_provider
    change_column_default :tenants, :document_provider, from: "sharepoint", to: nil

    # Remove default from warehouse_providers.provider_type
    change_column_default :warehouse_providers, :provider_type, from: "sharepoint", to: nil

    puts "[RemoveSharepointDatabaseDefaults] Removed hardcoded 'sharepoint' defaults from database columns"
  end

  def down
    # Restore defaults (for rollback)
    change_column_default :organizations, :document_provider, from: nil, to: "sharepoint"
    change_column_default :tenants, :document_provider, from: nil, to: "sharepoint"
    change_column_default :warehouse_providers, :provider_type, from: nil, to: "sharepoint"
  end
end
