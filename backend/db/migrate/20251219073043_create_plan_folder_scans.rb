# frozen_string_literal: true

class CreatePlanFolderScans < ActiveRecord::Migration[7.2]
  def change
    create_table :plan_folder_scans do |t|
      t.references :job, null: false, foreign_key: true
      t.string :sharepoint_file_id, null: false  # SharePoint file ID
      t.string :file_name
      t.datetime :file_modified_at              # Last modified time from SharePoint
      t.integer :file_size
      t.string :status, default: "pending"      # pending, processing, processed, skipped, error
      t.references :job_plan, foreign_key: true # Linked plan (once processed)
      t.text :error_message
      t.datetime :processed_at

      t.timestamps
    end

    add_index :plan_folder_scans, :sharepoint_file_id, unique: true
    add_index :plan_folder_scans, :status
    add_index :plan_folder_scans, [:job_id, :status]
  end
end
