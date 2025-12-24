# frozen_string_literal: true

class CreateGlSyncLogs < ActiveRecord::Migration[8.0]
  def change
    create_table :gl_sync_logs do |t|
      t.references :corporate_company, null: false, foreign_key: true
      t.references :gl_provider_credential, foreign_key: true

      # Provider Identity
      t.string :external_provider, null: false  # 'xero', 'quickbooks', 'myob'
      t.string :external_tenant_id, null: false

      # Sync Identity
      t.string :sync_type, null: false    # full, incremental, accounts, invoices, bills, etc.
      t.string :status, null: false       # started, in_progress, completed, failed, cancelled
      t.datetime :started_at
      t.datetime :completed_at

      # Progress tracking
      t.integer :records_processed, default: 0
      t.integer :records_created, default: 0
      t.integer :records_updated, default: 0
      t.integer :records_skipped, default: 0
      t.integer :records_failed, default: 0
      t.integer :total_records               # Total to process (if known)

      # Error handling
      t.text :error_message
      t.jsonb :error_details, default: {}    # Detailed error info

      # Sync metadata
      t.jsonb :details, default: {}          # Additional sync details
      t.datetime :sync_from                  # For incremental: modified_after
      t.datetime :sync_to                    # For incremental: modified_before

      # Triggered by
      t.string :trigger                      # manual, scheduled, webhook, initial
      t.references :triggered_by, foreign_key: { to_table: :users }

      t.timestamps
    end

    # Performance indexes
    add_index :gl_sync_logs, [:corporate_company_id, :external_provider, :external_tenant_id, :created_at],
              name: 'idx_gl_sync_logs_lookup'
    add_index :gl_sync_logs, :status
    add_index :gl_sync_logs, :sync_type
    add_index :gl_sync_logs, :started_at
  end
end
