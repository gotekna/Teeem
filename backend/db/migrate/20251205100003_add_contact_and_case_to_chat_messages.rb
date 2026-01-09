class AddContactAndCaseToChatMessages < ActiveRecord::Migration[8.0]
  def change
    add_column :chat_messages, :contact_id, :bigint
    add_column :chat_messages, :case_id, :bigint
    add_index :chat_messages, :contact_id
    add_index :chat_messages, :case_id
  end
end
