class CreateBasiqCredentials < ActiveRecord::Migration[8.0]
  def change
    create_table :basiq_credentials do |t|
      # Owner (polymorphic - usually Organization)
      t.references :owner, polymorphic: true, null: false, index: true

      # Basiq user ID (created via API)
      t.string :basiq_user_id, null: false, index: { unique: true }

      # Status tracking
      t.string :status, default: "pending", null: false
      # Status values: pending, connected, error, disconnected

      # Connection metadata
      t.string :connected_institution_name
      t.string :connected_institution_id
      t.datetime :last_sync_at
      t.datetime :consent_expires_at

      # Error tracking
      t.string :last_error
      t.datetime :last_error_at

      t.timestamps
    end

    add_index :basiq_credentials, :status
    add_index :basiq_credentials, [:owner_type, :owner_id, :status]
  end
end
