class AddFileAttachmentToChatMessages < ActiveRecord::Migration[8.0]
  def change
    add_column :chat_messages, :message_type, :string, default: 'text'
    add_column :chat_messages, :file_url, :string
    add_column :chat_messages, :file_name, :string
  end
end
