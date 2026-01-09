class CreateXeroSyncStatuses < ActiveRecord::Migration[8.0]
  def change
    create_table :xero_sync_statuses do |t|
      t.string :sync_type, null: false  # 'invoices', 'contacts', 'pdfs', 'payments'
      t.string :tenant_id
      t.datetime :last_synced_at
      t.datetime :next_sync_at
      t.string :status  # 'success', 'failed', 'in_progress'
      t.integer :records_synced
      t.text :last_error

      t.timestamps
    end

    add_index :xero_sync_statuses, [ :sync_type, :tenant_id ], unique: true
  end
end
