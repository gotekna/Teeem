class CreateChatMessages < ActiveRecord::Migration[8.0]
  def change
    create_table :chat_messages do |t|
      t.references :user, null: false, foreign_key: true
      t.references :project, null: true, foreign_key: true
      t.text :content, null: false
      t.string :channel, null: false, default: 'general'

      t.timestamps
    end

    add_index :chat_messages, [ :channel, :created_at ]
    add_index :chat_messages, [ :project_id, :created_at ]
  end
end
