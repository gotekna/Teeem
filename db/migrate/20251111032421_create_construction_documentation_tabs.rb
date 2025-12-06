class CreateConstructionDocumentationTabs < ActiveRecord::Migration[8.0]
  def change
    create_table :construction_documentation_tabs do |t|
      t.references :construction, null: false, foreign_key: true
      t.string :name, null: false
      t.string :icon # Icon name (e.g., 'DocumentTextIcon', 'WrenchIcon')
      t.string :color # Hex color code
      t.text :description
      t.integer :sequence_order, default: 0
      t.boolean :is_active, default: true

      t.timestamps
    end

    add_index :construction_documentation_tabs, [ :construction_id, :sequence_order ]
    add_index :construction_documentation_tabs, [ :construction_id, :name ], unique: true
  end
end
