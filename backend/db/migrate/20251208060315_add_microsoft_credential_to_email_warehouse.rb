class AddMicrosoftCredentialToEmailWarehouse < ActiveRecord::Migration[8.0]
  def change
    # Add reference to track which Microsoft org this email was synced from
    add_reference :email_warehouse, :microsoft_credential,
                  foreign_key: { to_table: :organization_microsoft_app_credentials },
                  null: true

    # Backfill existing emails to Tekna (they're all from Tekna org)
    reversible do |dir|
      dir.up do
        execute <<-SQL
          UPDATE email_warehouse
          SET microsoft_credential_id = (
            SELECT id FROM organization_microsoft_app_credentials
            WHERE name = 'Tekna'
            LIMIT 1
          )
          WHERE microsoft_credential_id IS NULL;
        SQL
      end
    end
  end
end
