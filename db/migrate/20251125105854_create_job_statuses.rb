class CreateJobStatuses < ActiveRecord::Migration[8.0]
  def change
    create_table :job_statuses do |t|
      t.string :name, null: false
      t.integer :position, default: 0
      t.boolean :is_active, default: true
      t.string :color  # For UI badge color

      t.timestamps
    end

    add_index :job_statuses, :position
    add_index :job_statuses, :is_active
  end
end
