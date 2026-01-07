class AddIsCadCategoryToEntityTabs < ActiveRecord::Migration[8.0]
  def change
    add_column :entity_tabs, :is_cad_category, :boolean
  end
end
