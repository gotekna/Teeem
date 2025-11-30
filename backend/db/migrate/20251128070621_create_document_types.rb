class CreateDocumentTypes < ActiveRecord::Migration[8.0]
  def change
    create_table :document_types do |t|
      t.string :name, null: false
      t.string :folder
      t.text :description
      t.string :category  # corporate, tax, compliance
      t.boolean :requires_filing, default: false
      t.integer :retention_years
      t.boolean :active, default: true

      t.timestamps
    end
    add_index :document_types, :name, unique: true
    add_index :document_types, :folder
    add_index :document_types, :category
    add_index :document_types, :active
  end
end
