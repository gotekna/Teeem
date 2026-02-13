class CreateChatConversations < ActiveRecord::Migration[7.2]
  def change
    create_table :chat_conversations do |t|
      t.string :conversation_type, null: false, default: "group"
      t.string :name
      t.bigint :created_by_id, null: false
      t.bigint :tenant_id
      t.timestamps
    end

    add_index :chat_conversations, :tenant_id
    add_index :chat_conversations, :created_by_id
    add_foreign_key :chat_conversations, :users, column: :created_by_id
    add_foreign_key :chat_conversations, :tenants

    create_table :chat_conversation_participants do |t|
      t.bigint :chat_conversation_id, null: false
      t.bigint :user_id, null: false
      t.datetime :last_read_at
      t.boolean :is_admin, default: false
      t.timestamps
    end

    add_index :chat_conversation_participants, [:chat_conversation_id, :user_id],
              unique: true, name: "idx_chat_conv_participants_unique"
    add_index :chat_conversation_participants, :user_id
    add_foreign_key :chat_conversation_participants, :chat_conversations
    add_foreign_key :chat_conversation_participants, :users

    # Groups use chat_conversation_id; DMs continue using recipient_user_id
    add_column :chat_messages, :chat_conversation_id, :bigint
    add_index :chat_messages, :chat_conversation_id
    add_foreign_key :chat_messages, :chat_conversations
  end
end
