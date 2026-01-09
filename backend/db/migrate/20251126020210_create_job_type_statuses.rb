class CreateJobTypeStatuses < ActiveRecord::Migration[8.0]
  def change
    create_table :job_type_statuses do |t|
      t.references :job_type, null: false, foreign_key: true
      t.references :job_status, null: false, foreign_key: true
      t.integer :position, default: 0

      t.timestamps
    end

    add_index :job_type_statuses, [ :job_type_id, :job_status_id ], unique: true
    add_index :job_type_statuses, :position
  end
end
