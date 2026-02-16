# frozen_string_literal: true

# Create local SSoT table for Xero tracking options.
# Eliminates need to call Xero API for tracking option lookups.
# Synced from Xero, and new options pushed to Xero on job creation.
class CreateXeroTrackingOptions < ActiveRecord::Migration[7.1]
  def change
    create_table :xero_tracking_options do |t|
      t.string :xero_tracking_option_id, null: false
      t.string :xero_tracking_category_id
      t.string :name, null: false
      t.string :status, default: "ACTIVE"
      t.references :tenant, null: false, foreign_key: true

      t.timestamps
    end

    add_index :xero_tracking_options, :xero_tracking_option_id, unique: true
    add_index :xero_tracking_options, [:tenant_id, :name]

    # Backfill from existing xero_job_tracking_links
    reversible do |dir|
      dir.up do
        execute <<-SQL
          INSERT INTO xero_tracking_options (xero_tracking_option_id, name, status, tenant_id, created_at, updated_at)
          SELECT DISTINCT tracking_option_id, tracking_option_name, 'ACTIVE', tenant_id, NOW(), NOW()
          FROM xero_job_tracking_links
          WHERE tracking_option_id IS NOT NULL
          AND tracking_option_name IS NOT NULL
          ON CONFLICT (xero_tracking_option_id) DO NOTHING
        SQL
      end
    end
  end
end
