# frozen_string_literal: true

class CreateBackupConfigurations < ActiveRecord::Migration[7.2]
  def change
    create_table :backup_configurations do |t|
      t.references :organization, null: false, foreign_key: true, index: { unique: true }
      t.boolean :enabled, default: false, null: false
      t.string :database_schedule, default: "weekly_sunday", null: false
      t.string :document_schedule, default: "daily_2am", null: false
      t.integer :retention_days, default: 90, null: false
      t.boolean :mirror_enabled, default: false, null: false
      t.references :primary_credential, foreign_key: { to_table: :s3_compatible_credentials }
      t.references :secondary_credential, foreign_key: { to_table: :s3_compatible_credentials }
      t.datetime :last_database_backup_at
      t.datetime :last_document_backup_at
      t.datetime :last_mirror_sync_at
      t.jsonb :metadata, default: {}
      t.timestamps
    end

    # Create backup_logs table for tracking backup history
    create_table :backup_logs do |t|
      t.references :backup_configuration, null: false, foreign_key: true
      t.string :backup_type, null: false  # "database", "documents", "mirror"
      t.string :status, null: false       # "started", "completed", "failed"
      t.bigint :size_bytes
      t.integer :duration_seconds
      t.integer :files_count
      t.string :storage_key              # Path in storage
      t.string :provider_name            # "wasabi", "backblaze", etc.
      t.text :error_message
      t.jsonb :metadata, default: {}
      t.timestamps
    end

    add_index :backup_logs, [:backup_configuration_id, :backup_type, :created_at],
              name: "idx_backup_logs_config_type_created"
  end
end
