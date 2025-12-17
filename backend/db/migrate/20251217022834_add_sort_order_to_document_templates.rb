class AddSortOrderToDocumentTemplates < ActiveRecord::Migration[8.0]
  def change
    add_column :document_templates, :sort_order, :integer, default: 0, null: false
    add_index :document_templates, [:category, :sort_order]
  end
end
