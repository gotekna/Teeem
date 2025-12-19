# frozen_string_literal: true

# =============================================================================
# BatchOperation - THE ONE SSoT for all batch operation progress tracking
# =============================================================================
# Replaces: PlanUpload, PlanReextraction
# Adds: folder_scan, folder_process
#
# Operation Types:
#   - plan_upload: Upload and split multi-page PDF into plans
#   - plan_reextract: Re-extract and rename existing plans from PDF
#   - folder_scan: Scan SharePoint folders for new plan files
#   - folder_process: Process pending scanned files into plans
# =============================================================================
class CreateBatchOperations < ActiveRecord::Migration[8.0]
  def change
    create_table :batch_operations do |t|
      # Core relationships
      t.references :job, foreign_key: true  # Optional - folder_scan may not have a job
      t.references :user, foreign_key: true # Who initiated the operation

      # Operation type (SSoT for all batch operations)
      t.string :operation_type, null: false
      # Values: plan_upload, plan_reextract, folder_scan, folder_process

      # Status tracking
      t.string :status, default: "pending", null: false
      # Values: pending, processing, completed, failed
      t.string :current_step
      t.string :current_item_name  # What's being processed right now

      # Progress tracking (generic for all operation types)
      t.integer :total_items, default: 0
      t.integer :processed_items, default: 0

      # Results (JSONB for flexibility across operation types)
      t.jsonb :items_completed, default: []  # Array of completed item names/details
      t.jsonb :operation_errors, default: []  # Array of error objects {item, message}

      # Operation-specific metadata (JSONB for flexibility)
      t.jsonb :metadata, default: {}
      # Examples:
      # plan_upload: {original_filename, staging_file_id, job_plan_tab_id}
      # plan_reextract: {apply_templates: true, rename_sharepoint: true}
      # folder_scan: {jobs_scanned: [...], files_found: 12}
      # folder_process: {confidence_threshold: 80}

      # Error handling
      t.text :error_message

      # Timing
      t.datetime :started_at
      t.datetime :completed_at

      t.timestamps
    end

    # Indexes for common queries
    add_index :batch_operations, :operation_type
    add_index :batch_operations, :status
    add_index :batch_operations, [:job_id, :operation_type]
    add_index :batch_operations, [:status, :operation_type]
  end
end
