class AddBulkSyncProgressToOrganizationMicrosoftAppCredentials < ActiveRecord::Migration[8.0]
  def change
    add_column :organization_microsoft_app_credentials, :bulk_sync_progress, :jsonb, default: {}
  end
end
