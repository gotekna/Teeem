# frozen_string_literal: true

class CreateStorageBillingSnapshots < ActiveRecord::Migration[7.2]
  def change
    create_table :storage_billing_snapshots do |t|
      t.string :provider, null: false    # "wasabi" or "backblaze"
      t.string :period, null: false      # "2026-01" (year-month)
      t.float :total_size_gb
      t.integer :total_objects
      t.float :estimated_cost
      t.jsonb :details, default: {}
      t.timestamps
    end

    add_index :storage_billing_snapshots, [:provider, :period], unique: true
  end
end
