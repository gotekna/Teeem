# frozen_string_literal: true

class CreatePolarisCredentials < ActiveRecord::Migration[8.0]
  def change
    create_table :polaris_credentials do |t|
      t.references :organization, null: false, foreign_key: true
      t.text :api_key                # encrypted
      t.text :api_secret             # encrypted
      t.string :reseller_id
      t.string :status, default: "pending", null: false
      t.boolean :is_active, default: true, null: false
      t.text :error_message
      t.datetime :last_connected_at
      t.datetime :last_error_at
      t.jsonb :metadata, default: {}

      t.timestamps
    end

    add_index :polaris_credentials, [:organization_id, :is_active],
              unique: true,
              where: "is_active = true",
              name: "idx_polaris_credentials_active_org"
    add_index :polaris_credentials, :status
  end
end
