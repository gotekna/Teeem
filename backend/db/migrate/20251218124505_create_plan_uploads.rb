# frozen_string_literal: true

class CreatePlanUploads < ActiveRecord::Migration[8.0]
  def change
    create_table :plan_uploads do |t|
      t.references :job, null: false, foreign_key: true
      t.references :uploaded_by, foreign_key: { to_table: :users }
      t.references :job_plan_tab, foreign_key: true

      # Status tracking
      t.string :status, null: false, default: "pending"
      t.string :current_step
      t.text :error_message

      # File info
      t.string :original_filename, null: false
      t.string :staging_file_id
      t.bigint :file_size

      # Progress tracking
      t.integer :total_pages
      t.integer :processed_pages, default: 0

      # Results - array of plan IDs created
      t.jsonb :plans_created, default: []

      # Retry tracking
      t.integer :retry_count, default: 0
      t.datetime :last_retry_at

      # Timestamps
      t.datetime :started_at
      t.datetime :completed_at
      t.timestamps
    end

    add_index :plan_uploads, :status
    add_index :plan_uploads, [:job_id, :status]
    add_index :plan_uploads, :staging_file_id
  end
end
