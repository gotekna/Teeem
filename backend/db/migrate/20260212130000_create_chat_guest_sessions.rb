# frozen_string_literal: true

# Step 3 of Cross-Tenant Chat: Guest Chat Links
#
# ChatGuestSession: Shareable chat link that lets anyone (no account needed)
# chat with a Teeem user. Think Zoom meeting links but for chat.
#
# Flow:
#   1. Host clicks "Share Chat Link" → creates session with unique token
#   2. Guest opens link → enters name → starts chatting
#   3. Messages stored in host's tenant (data gravity)
#   4. Host sees conversation in their normal chat UI
#
class CreateChatGuestSessions < ActiveRecord::Migration[7.1]
  def change
    create_table :chat_guest_sessions do |t|
      t.references :tenant, null: false, foreign_key: true
      t.references :host_user, null: false, foreign_key: { to_table: :users }
      t.string :token, null: false, index: { unique: true }
      t.string :guest_name
      t.string :guest_email
      t.string :status, null: false, default: "pending" # pending, active, expired, closed
      t.datetime :expires_at
      t.datetime :guest_joined_at
      t.jsonb :metadata, default: {}
      t.timestamps
    end

    # ChatMessage changes for guest support
    add_reference :chat_messages, :chat_guest_session, foreign_key: true, null: true
    add_column :chat_messages, :guest_sender_name, :string

    # Make user_id optional (null for guest-sent messages)
    change_column_null :chat_messages, :user_id, true
  end
end
