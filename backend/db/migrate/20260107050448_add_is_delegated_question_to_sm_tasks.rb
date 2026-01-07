class AddIsDelegatedQuestionToSmTasks < ActiveRecord::Migration[8.0]
  def change
    add_column :sm_tasks, :is_delegated_question, :boolean, default: false, null: false
  end
end
