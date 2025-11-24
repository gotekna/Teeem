class AddLastRunByToAgentDefinitions < ActiveRecord::Migration[8.0]
  def change
    add_column :agent_definitions, :last_run_by_id, :bigint
    add_index :agent_definitions, :last_run_by_id
    add_foreign_key :agent_definitions, :users, column: :last_run_by_id, on_delete: :nullify
  end
end
