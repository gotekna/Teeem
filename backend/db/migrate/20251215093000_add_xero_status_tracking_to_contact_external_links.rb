class AddXeroStatusTrackingToContactExternalLinks < ActiveRecord::Migration[8.0]
  def change
    # Track Xero contact status
    add_column :contact_external_links, :xero_contact_status, :string, default: 'active'
    add_column :contact_external_links, :last_verified_at, :datetime

    # Add indexes for efficient queries
    add_index :contact_external_links, :xero_contact_status
    add_index :contact_external_links, :last_verified_at

    # Backfill existing records with last_verified_at = last_synced_at
    reversible do |dir|
      dir.up do
        execute <<-SQL
          UPDATE contact_external_links
          SET last_verified_at = last_synced_at
          WHERE last_synced_at IS NOT NULL
        SQL
      end
    end
  end
end
