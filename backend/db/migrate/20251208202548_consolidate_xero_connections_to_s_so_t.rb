class ConsolidateXeroConnectionsToSSoT < ActiveRecord::Migration[8.0]
  def up
    # Add foreign key to xero_credentials (SSoT for OAuth tokens)
    add_reference :company_xero_connections, :xero_credential, foreign_key: true, index: true

    # Add fields we need for accounting configuration
    add_column :company_xero_connections, :accounting_method, :string
    add_column :company_xero_connections, :financial_year_end, :date

    # Migrate existing data: Match company connections to global credentials by tenant_id
    CompanyXeroConnection.reset_column_information

    CompanyXeroConnection.find_each do |connection|
      # Find matching global credential by tenant_id
      credential = XeroCredential.find_by(tenant_id: connection.xero_tenant_id)

      if credential
        connection.update_column(:xero_credential_id, credential.id)
        puts "✓ Linked #{connection.company.name} to credential for #{credential.tenant_name}"
      else
        puts "⚠ No credential found for company #{connection.company.name} (tenant: #{connection.xero_tenant_id})"
      end
    end

    # Remove duplicate token fields (now in xero_credentials only)
    remove_column :company_xero_connections, :encrypted_access_token
    remove_column :company_xero_connections, :encrypted_refresh_token
    remove_column :company_xero_connections, :token_expires_at
  end

  def down
    # Restore token columns
    add_column :company_xero_connections, :encrypted_access_token, :text
    add_column :company_xero_connections, :encrypted_refresh_token, :text
    add_column :company_xero_connections, :token_expires_at, :datetime

    # Copy tokens back from credentials to connections
    CompanyXeroConnection.reset_column_information

    CompanyXeroConnection.find_each do |connection|
      if connection.xero_credential
        connection.update_columns(
          encrypted_access_token: connection.xero_credential.access_token,
          encrypted_refresh_token: connection.xero_credential.refresh_token,
          token_expires_at: connection.xero_credential.expires_at
        )
      end
    end

    # Remove fields
    remove_column :company_xero_connections, :financial_year_end
    remove_column :company_xero_connections, :accounting_method

    # Remove foreign key
    remove_reference :company_xero_connections, :xero_credential, foreign_key: true, index: true
  end
end
