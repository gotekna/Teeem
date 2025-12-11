class CreateDocumentTemplates < ActiveRecord::Migration[8.0]
  def change
    create_table :document_templates do |t|
      t.string :name, null: false
      t.text :description
      t.string :category  # job, contact, quote, invoice, contract

      # SharePoint reference
      t.string :sharepoint_site_id
      t.string :sharepoint_drive_id
      t.string :sharepoint_item_id
      t.string :sharepoint_path

      # Output config
      t.string :output_format, default: "pdf"  # docx, pdf, both
      t.string :output_naming_pattern
      t.jsonb :data_schema, default: {}  # { fields: [], subject_type: "Job" }

      t.boolean :is_active, default: true
      t.timestamps
    end

    add_index :document_templates, :category
    add_index :document_templates, :is_active
  end
end
