class CreateUserJobTabConfigs < ActiveRecord::Migration[8.0]
  def change
    create_table :user_job_tab_configs do |t|
      t.references :user, null: false, foreign_key: true
      t.references :job_tab, null: false, foreign_key: true
      t.integer :position, null: false, default: 0
      t.integer :parent_job_tab_id
      t.boolean :is_hidden, default: false

      t.timestamps
    end

    add_index :user_job_tab_configs, [:user_id, :job_tab_id], unique: true, name: 'idx_user_job_tab_config_unique'
    add_index :user_job_tab_configs, [:user_id, :position]
    add_index :user_job_tab_configs, [:user_id, :parent_job_tab_id]

    add_foreign_key :user_job_tab_configs, :job_tabs, column: :parent_job_tab_id
  end
end
