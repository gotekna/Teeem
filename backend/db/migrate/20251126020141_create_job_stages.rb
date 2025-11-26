class CreateJobStages < ActiveRecord::Migration[8.0]
  def change
    create_table :job_stages do |t|
      t.string :name, null: false
      t.integer :position, default: 0
      t.boolean :is_active, default: true
      t.string :color

      t.timestamps
    end

    add_index :job_stages, :position
    add_index :job_stages, :is_active
  end
end
