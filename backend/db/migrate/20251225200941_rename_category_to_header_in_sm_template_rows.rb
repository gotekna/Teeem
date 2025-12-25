class RenameCategoryToHeaderInSmTemplateRows < ActiveRecord::Migration[8.0]
  def change
    rename_column :sm_template_rows, :category, :header
  end
end
