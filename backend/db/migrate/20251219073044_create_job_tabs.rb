class CreateJobTabs < ActiveRecord::Migration[8.0]
  def change
    create_table :job_tabs do |t|
      t.string :name, null: false
      t.string :slug, null: false
      t.string :icon, null: false
      t.integer :position, null: false, default: 0
      t.boolean :is_active, default: true

      t.timestamps
    end

    add_index :job_tabs, :slug, unique: true
    add_index :job_tabs, :position
    add_index :job_tabs, :is_active
  end
end
