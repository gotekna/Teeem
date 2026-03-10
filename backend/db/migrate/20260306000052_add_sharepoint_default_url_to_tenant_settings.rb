class AddSharepointDefaultUrlToTenantSettings < ActiveRecord::Migration[7.2]
  def change
    add_column :tenant_settings, :sharepoint_default_url, :string, comment: "Default SharePoint URL opened from nav (e.g., https://gotekna.sharepoint.com/sites/TEEEM/Shared%20Documents)"
  end
end
