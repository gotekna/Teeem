class CreateXeroJobTrackingLinks < ActiveRecord::Migration[7.1]
  def up
    create_table :xero_job_tracking_links do |t|
      t.references :job, null: false, foreign_key: true
      t.string :tracking_option_id, null: false    # Xero UUID
      t.string :tracking_option_name               # Display name (e.g., "P-106HAR 106 Harold St")
      t.string :variant                            # nil, "P", "D", "C", "S" etc.
      t.boolean :is_primary, default: false        # SSoT option for this job
      t.references :tenant, null: false, foreign_key: true
      t.timestamps
    end

    add_index :xero_job_tracking_links, :tracking_option_id, unique: true
    add_index :xero_job_tracking_links, [:job_id, :is_primary]

    # Backfill: Migrate existing jobs.xero_tracking_option_id into join table
    execute <<-SQL
      INSERT INTO xero_job_tracking_links (job_id, tracking_option_id, tracking_option_name, is_primary, tenant_id, created_at, updated_at)
      SELECT id, xero_tracking_option_id, xero_tracking_option_name, true, tenant_id, NOW(), NOW()
      FROM jobs
      WHERE xero_tracking_option_id IS NOT NULL
        AND xero_tracking_option_id != ''
    SQL
  end

  def down
    drop_table :xero_job_tracking_links
  end
end
