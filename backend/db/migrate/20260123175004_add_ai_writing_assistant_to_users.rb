class AddAiWritingAssistantToUsers < ActiveRecord::Migration[7.1]
  def change
    add_column :users, :enable_ai_writing_assistant, :boolean, default: false, null: false
  end
end
