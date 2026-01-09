class AddTsAndCategoryToSmTemplateRows < ActiveRecord::Migration[8.0]
  def change
    add_column :sm_template_rows, :ts_identifier, :integer
    add_column :sm_template_rows, :category, :string
    add_index :sm_template_rows, :ts_identifier
    add_index :sm_template_rows, :category
  end
end
