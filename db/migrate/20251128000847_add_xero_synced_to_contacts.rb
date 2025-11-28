class AddXeroSyncedToContacts < ActiveRecord::Migration[8.0]
  def change
    add_column :contacts, :xero_synced, :boolean, default: false, null: false

    # Backfill: set xero_synced = true for contacts that have a xero_id
    reversible do |dir|
      dir.up do
        execute <<-SQL
          UPDATE contacts SET xero_synced = true WHERE xero_id IS NOT NULL
        SQL
      end
    end
  end
end
