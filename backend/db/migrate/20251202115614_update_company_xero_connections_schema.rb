class UpdateCompanyXeroConnectionsSchema < ActiveRecord::Migration[8.0]
  def change
    # Rename columns to match model expectations
    rename_column :company_xero_connections, :tenant_id, :xero_tenant_id
    rename_column :company_xero_connections, :tenant_name, :xero_tenant_name
    rename_column :company_xero_connections, :access_token, :encrypted_access_token
    rename_column :company_xero_connections, :refresh_token, :encrypted_refresh_token

    # Remove boolean connected, add string connection_status
    remove_column :company_xero_connections, :connected, :boolean

    # Add new columns
    add_column :company_xero_connections, :connection_status, :string, default: 'disconnected'
    add_column :company_xero_connections, :last_sync_error, :text

    # Add index for connection_status (tenant_id index may already exist)
    add_index :company_xero_connections, :connection_status unless index_exists?(:company_xero_connections, :connection_status)
  end
end
