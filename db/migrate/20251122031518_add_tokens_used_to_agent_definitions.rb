class AddTokensUsedToAgentDefinitions < ActiveRecord::Migration[8.0]
  def change
    add_column :agent_definitions, :last_run_tokens, :integer
    add_column :agent_definitions, :total_tokens, :integer
  end
end
