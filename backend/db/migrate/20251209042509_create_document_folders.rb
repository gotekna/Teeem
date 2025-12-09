class CreateDocumentFolders < ActiveRecord::Migration[8.0]
  def change
    create_table :document_folders do |t|
      t.string :name, null: false
      t.text :description
      t.integer :order_position, null: false, default: 0
      t.jsonb :entity_types, null: false, default: []
      t.boolean :active, null: false, default: true

      t.timestamps
    end

    add_index :document_folders, :name, unique: true
    add_index :document_folders, :order_position
    add_index :document_folders, :entity_types, using: :gin
  end
end
