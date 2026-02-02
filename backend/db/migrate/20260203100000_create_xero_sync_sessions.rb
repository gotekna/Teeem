# frozen_string_literal: true

# XeroSyncSession: Progress tracking for ultra-scale batch sync
#
# Part of the Ultra-Scale Xero Sync Architecture (Feb 2026)
# Enables fan-out pattern: orchestrator -> batch fetchers -> batch processors
#
# Key features:
# - Track progress across parallel batch jobs
# - Support incremental sync (modified_since)
# - Checkpoint for resumability after failures
# - Per-tenant sync sessions
class CreateXeroSyncSessions < ActiveRecord::Migration[8.0]
  def change
    create_table :xero_sync_sessions do |t|
      # Xero org identifier
      t.string :tenant_id, null: false

      # TEEEM tenant for multi-tenancy scoping
      t.references :teeem_tenant, foreign_key: { to_table: :tenants }, null: true

      # What we're syncing
      t.string :sync_type, null: false, default: 'contacts'

      # Session status: pending, fetching, processing, completed, failed
      t.string :status, null: false, default: 'pending'

      # Sync mode: full or incremental
      t.string :sync_mode, default: 'full'

      # For incremental sync: only fetch contacts modified since this time
      t.datetime :modified_since

      # Progress tracking
      t.integer :total_records, default: 0       # Estimated total (refined as we fetch)
      t.integer :fetched_count, default: 0       # How many fetched from Xero API
      t.integer :processed_count, default: 0     # How many processed into DB
      t.integer :created_count, default: 0       # New contacts created
      t.integer :updated_count, default: 0       # Existing contacts updated
      t.integer :skipped_count, default: 0       # Skipped (validation, duplicates)
      t.integer :error_count, default: 0         # Individual record errors

      # Resumability: checkpoint after each batch
      t.integer :last_page_fetched, default: 0
      t.jsonb :checkpoint_data, default: {}      # Additional state for resume

      # Timing
      t.datetime :started_at
      t.datetime :completed_at
      t.integer :duration_seconds                # Calculated on completion

      # Error tracking
      t.text :error_message

      t.timestamps
    end

    add_index :xero_sync_sessions, [:tenant_id, :sync_type, :status]
    add_index :xero_sync_sessions, [:status, :created_at]
    add_index :xero_sync_sessions, :teeem_tenant_id
  end
end
