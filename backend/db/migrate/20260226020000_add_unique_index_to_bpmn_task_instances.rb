class AddUniqueIndexToBpmnTaskInstances < ActiveRecord::Migration[8.0]
  def up
    # Remove duplicate task instances, keeping the most recently updated one per (token, node)
    execute <<~SQL
      DELETE FROM bpmn_task_instances
      WHERE id NOT IN (
        SELECT DISTINCT ON (bpmn_token_id, bpmn_node_id) id
        FROM bpmn_task_instances
        ORDER BY bpmn_token_id, bpmn_node_id,
          CASE WHEN status = 'completed' THEN 0 WHEN status = 'in_progress' THEN 1 ELSE 2 END,
          updated_at DESC
      )
    SQL

    add_index :bpmn_task_instances, [:bpmn_token_id, :bpmn_node_id],
              unique: true,
              name: "idx_bpmn_task_instances_unique_token_node"
  end

  def down
    remove_index :bpmn_task_instances, name: "idx_bpmn_task_instances_unique_token_node"
  end
end
