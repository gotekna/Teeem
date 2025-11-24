class AddCreatedByAndUpdatedByToAgentDefinitions < ActiveRecord::Migration[8.0]
  def change
    add_reference :agent_definitions, :created_by, foreign_key: { to_table: :users }, null: true
    add_reference :agent_definitions, :updated_by, foreign_key: { to_table: :users }, null: true
  end
end
