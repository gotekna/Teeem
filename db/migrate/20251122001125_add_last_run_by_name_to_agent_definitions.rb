class AddLastRunByNameToAgentDefinitions < ActiveRecord::Migration[8.0]
  def change
    add_column :agent_definitions, :last_run_by_name, :string
  end
end
