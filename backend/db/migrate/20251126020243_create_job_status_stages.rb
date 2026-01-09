class CreateJobStatusStages < ActiveRecord::Migration[8.0]
  def change
    create_table :job_status_stages do |t|
      t.references :job_type, null: false, foreign_key: true
      t.references :job_status, null: false, foreign_key: true
      t.references :job_stage, null: false, foreign_key: true
      t.integer :position, default: 0
      t.boolean :is_required, default: false

      t.timestamps
    end

    add_index :job_status_stages, [ :job_type_id, :job_status_id, :job_stage_id ],
      unique: true, name: 'index_job_status_stages_on_type_status_stage'
    add_index :job_status_stages, :position
  end
end
