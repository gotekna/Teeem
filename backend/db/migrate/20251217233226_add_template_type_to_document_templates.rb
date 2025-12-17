class AddTemplateTypeToDocumentTemplates < ActiveRecord::Migration[8.0]
  def change
    add_column :document_templates, :template_type, :string, default: "word", null: false
    add_column :document_templates, :local_template_path, :string
    add_column :document_templates, :layout, :string
    add_column :document_templates, :is_legal_format, :boolean, default: false, null: false
    add_column :document_templates, :legal_source, :string

    add_index :document_templates, :template_type
    add_index :document_templates, :is_legal_format
  end
end
