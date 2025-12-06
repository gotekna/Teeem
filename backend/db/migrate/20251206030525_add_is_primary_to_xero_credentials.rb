class AddIsPrimaryToXeroCredentials < ActiveRecord::Migration[8.0]
  def change
    add_column :xero_credentials, :is_primary, :boolean, default: false, null: false
    add_index :xero_credentials, :is_primary

    # Set the most recent credential as primary if any exist
    reversible do |dir|
      dir.up do
        if XeroCredential.exists?
          XeroCredential.order(created_at: :desc).first.update_column(:is_primary, true)
        end
      end
    end
  end
end
