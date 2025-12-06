class CreateProjects < ActiveRecord::Migration[8.0]
  def change
    create_table :projects do |t|
      t.string :name, null: false
      t.string :project_code, index: { unique: true }
      t.text :description
      t.date :start_date
      t.date :planned_end_date
      t.date :actual_end_date
      t.string :status, default: 'planning'
      t.string :client_name
      t.text :site_address
      t.references :project_manager, null: false, foreign_key: { to_table: :users }

      t.timestamps
    end

    add_index :projects, :status
    add_index :projects, [ :start_date, :planned_end_date ]
  end
end
