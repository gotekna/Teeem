# frozen_string_literal: true

class CreateXeroSyncEvents < ActiveRecord::Migration[8.0]
  def change
    create_table :xero_sync_events do |t|
      t.references :xero_credential, foreign_key: true

      # Sync classification
      t.string :sync_type, null: false  # invoices, contacts, bank_transactions, attachments, payments
      t.string :event_type, null: false # started, completed, failed, webhook_received, skipped
      t.string :trigger, null: false    # scheduled, webhook, manual, retry, health_check

      # Sync results
      t.integer :records_processed, default: 0, null: false
      t.integer :records_created, default: 0, null: false
      t.integer :records_updated, default: 0, null: false
      t.integer :records_skipped, default: 0, null: false
      t.integer :records_failed, default: 0, null: false

      # Error tracking
      t.text :error_message
      t.string :error_class

      # Timing
      t.datetime :started_at
      t.datetime :completed_at
      t.integer :duration_ms

      # Additional context
      t.jsonb :metadata, default: {}

      t.timestamps
    end

    add_index :xero_sync_events, [ :xero_credential_id, :sync_type, :created_at ], name: 'idx_xero_sync_events_cred_type_time'
    add_index :xero_sync_events, [ :sync_type, :event_type, :created_at ], name: 'idx_xero_sync_events_type_status'
    add_index :xero_sync_events, :created_at
  end
end
