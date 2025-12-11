class CreateDocumentTemplates < ActiveRecord::Migration[8.0]
  def change
    create_table :document_templates do |t|
      t.string :name
      t.text :description
      t.string :category
      t.string :sharepoint_site_id
      t.string :sharepoint_drive_id
      t.string :sharepoint_item_id
      t.string :sharepoint_path
      t.string :output_format
      t.string :output_naming_pattern
      t.jsonb :data_schema
      t.boolean :is_active

      t.timestamps
    end
  end
end
