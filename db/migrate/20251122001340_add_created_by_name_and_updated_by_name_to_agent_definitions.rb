class AddCreatedByNameAndUpdatedByNameToAgentDefinitions < ActiveRecord::Migration[8.0]
  def change
    add_column :agent_definitions, :created_by_name, :string
    add_column :agent_definitions, :updated_by_name, :string
  end
end
