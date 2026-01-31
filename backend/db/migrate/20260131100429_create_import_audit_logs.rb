# frozen_string_literal: true

# Client Onboarding System - Phase 1.3
# Creates import_audit_logs table for tracking data import history
class CreateImportAuditLogs < ActiveRecord::Migration[8.0]
  def change
    create_table :import_audit_logs do |t|
      t.references :tenant, null: false, foreign_key: true, index: true
      t.references :user, foreign_key: true, index: true
      t.string :import_type, null: false
      t.string :status, default: 'completed', null: false
      t.jsonb :counts, default: {}
      t.integer :rows_processed, default: 0
      t.integer :rows_created, default: 0
      t.integer :rows_updated, default: 0
      t.integer :rows_skipped, default: 0
      t.integer :errors_count, default: 0
      t.integer :warnings_count, default: 0
      t.jsonb :error_details, default: []
      t.jsonb :warning_details, default: []
      t.jsonb :options_used, default: {}
      t.string :filename
      t.integer :file_size
      t.datetime :started_at
      t.datetime :completed_at
      t.timestamps
    end

    add_index :import_audit_logs, :import_type
    add_index :import_audit_logs, :status
    add_index :import_audit_logs, :created_at
  end
end
