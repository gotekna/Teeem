class RemoveNotNullConstraintsFromOrgMicrosoftCredentials < ActiveRecord::Migration[8.0]
  def change
    change_column_null :organization_microsoft_app_credentials, :client_id, true
    change_column_null :organization_microsoft_app_credentials, :client_secret, true
    change_column_null :organization_microsoft_app_credentials, :tenant_id, true
  end
end
