class CreateS3CompatibleCredentials < ActiveRecord::Migration[8.0]
  def change
    create_table :s3_compatible_credentials do |t|
      # Organization scope (optional for global credentials)
      t.references :organization, null: true, foreign_key: true

      # Credential identification
      t.string :name, null: false                    # Display name (e.g., "Backblaze B2 - Job Documents")
      t.string :provider_type, null: false           # aws_s3, backblaze_b2, minio, wasabi, synology, other

      # S3 connection settings
      t.string :endpoint                             # Custom endpoint (required for non-AWS)
      t.string :region, null: false                  # Region (e.g., us-west-004 for B2)
      t.string :bucket, null: false                  # Bucket name

      # Authentication (encrypted)
      t.string :access_key_id, null: false           # S3 access key
      t.string :secret_access_key, null: false       # S3 secret key

      # Document storage configuration
      t.string :root_path, default: ""               # Root prefix for all files (e.g., "teeem/jobs")

      # Status tracking
      t.boolean :is_active, default: true, null: false
      t.string :status, default: "pending"           # pending, connected, error, disconnected

      # Metadata for provider-specific settings
      t.jsonb :metadata, default: {}

      t.timestamps
    end

    # Indexes
    add_index :s3_compatible_credentials, :is_active
    add_index :s3_compatible_credentials, :provider_type
    add_index :s3_compatible_credentials, :status
    add_index :s3_compatible_credentials, [ :organization_id, :is_active ]
  end
end
