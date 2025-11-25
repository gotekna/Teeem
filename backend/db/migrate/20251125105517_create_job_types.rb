class CreateJobTypes < ActiveRecord::Migration[8.0]
  def change
    create_table :job_types do |t|
      t.string :name, null: false
      t.integer :position, default: 0
      t.boolean :is_active, default: true

      t.timestamps
    end

    add_index :job_types, :position
    add_index :job_types, :is_active
  end
end
