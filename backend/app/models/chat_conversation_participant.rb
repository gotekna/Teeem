class ChatConversationParticipant < ApplicationRecord
  belongs_to :chat_conversation
  belongs_to :user, optional: true

  validates :user_id, uniqueness: { scope: :chat_conversation_id }

  def mark_as_read!
    update!(last_read_at: Time.current)
  end
end
