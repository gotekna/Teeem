class CreateFolderTemplateItems < ActiveRecord::Migration[8.0]
  def change
    create_table :folder_template_items do |t|
      t.references :folder_template, null: false, foreign_key: true, index: true
      t.string :name, null: false
      t.integer :level, default: 0, null: false
      t.integer :order, default: 0, null: false
      t.references :parent, foreign_key: { to_table: :folder_template_items }, null: true, index: true
      t.text :description

      t.timestamps
    end

    add_index :folder_template_items, [ :folder_template_id, :order ]
    add_index :folder_template_items, :level
  end
end
