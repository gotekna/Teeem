class AddCategoryToAgentDefinitions < ActiveRecord::Migration[8.0]
  def change
    add_column :agent_definitions, :category, :string
  end
end
