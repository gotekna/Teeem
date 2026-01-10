class AddIncludeInResponseToSmActionItems < ActiveRecord::Migration[8.0]
  def change
    add_column :task_action_items, :include_in_response, :boolean, default: false
  end
end
