class CreateSmTemplates < ActiveRecord::Migration[8.0]
  def change
    create_table :sm_templates do |t|
      t.string :name, null: false
      t.text :description
      t.boolean :is_default, default: false
      t.boolean :is_active, default: true
      t.bigint :created_by_id
      t.bigint :updated_by_id

      t.timestamps
    end

    add_index :sm_templates, :is_default
    add_index :sm_templates, :is_active
    add_foreign_key :sm_templates, :users, column: :created_by_id
    add_foreign_key :sm_templates, :users, column: :updated_by_id
  end
end
