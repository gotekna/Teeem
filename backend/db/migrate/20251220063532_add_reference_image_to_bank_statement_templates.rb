class AddReferenceImageToBankStatementTemplates < ActiveRecord::Migration[8.0]
  def change
    add_column :bank_statement_templates, :reference_image_path, :string
  end
end
