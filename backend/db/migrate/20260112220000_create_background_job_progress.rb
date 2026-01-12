# frozen_string_literal: true

class CreateBackgroundJobProgress < ActiveRecord::Migration[7.0]
  def change
    create_table :background_job_progress do |t|
      # Job identification
      t.string :job_type, null: false        # e.g., "folder_reorganization", "document_migration"
      t.string :job_id, null: false          # Unique ID for this job run
      t.string :scope                        # e.g., "corporate", "job", "email"

      # Progress tracking
      t.string :status, default: "pending"   # pending, running, completed, failed
      t.integer :total_items, default: 0
      t.integer :processed_items, default: 0
      t.integer :success_count, default: 0
      t.integer :error_count, default: 0

      # Details
      t.string :current_item                 # Currently processing item (for UI display)
      t.text :message                        # Status message
      t.jsonb :errors, default: []           # Array of error details
      t.jsonb :metadata, default: {}         # Additional job-specific data

      # Timing
      t.datetime :started_at
      t.datetime :completed_at

      t.timestamps
    end

    add_index :background_job_progress, :job_type
    add_index :background_job_progress, :job_id, unique: true
    add_index :background_job_progress, :status
    add_index :background_job_progress, [:job_type, :status]
    add_index :background_job_progress, :created_at
  end
end
