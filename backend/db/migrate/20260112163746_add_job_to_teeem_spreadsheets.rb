class AddJobToTeeemSpreadsheets < ActiveRecord::Migration[8.0]
  def change
    # Add job_id to allow spreadsheets to be attached to jobs (data warehouse integration)
    add_reference :teeem_spreadsheets, :job, null: true, foreign_key: true

    # Add description field for better organization
    add_column :teeem_spreadsheets, :description, :text

    # Index for finding spreadsheets by job
    add_index :teeem_spreadsheets, [:job_id, :updated_at], name: "index_teeem_spreadsheets_on_job_id_and_updated_at"
  end
end
