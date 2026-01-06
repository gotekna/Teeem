class AddEmailKeywordsToSmTasks < ActiveRecord::Migration[8.0]
  def change
    add_column :sm_tasks, :email_keywords, :text
  end
end
