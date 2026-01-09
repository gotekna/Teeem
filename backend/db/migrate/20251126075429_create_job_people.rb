class CreateJobPeople < ActiveRecord::Migration[8.0]
  def change
    create_table :job_people do |t|
      t.references :job, null: false, foreign_key: true
      t.references :contact, null: false, foreign_key: true
      t.string :role
      t.text :notes
      t.boolean :is_primary, default: false, null: false

      t.timestamps
    end

    add_index :job_people, [ :job_id, :contact_id ], unique: true
    add_index :job_people, [ :job_id, :is_primary ]
  end
end
