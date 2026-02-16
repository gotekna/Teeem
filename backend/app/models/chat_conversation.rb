class ChatConversation < ApplicationRecord
  acts_as_tenant :tenant

  belongs_to :creator, class_name: "User", foreign_key: "created_by_id"
  has_many :chat_conversation_participants, dependent: :destroy
  has_many :users, through: :chat_conversation_participants
  has_many :chat_messages, dependent: :nullify

  # Constants
  CONVERSATION_TYPES = %w[group].freeze

  validates :name, presence: true
  validates :conversation_type, inclusion: { in: CONVERSATION_TYPES }

  scope :groups, -> { where(conversation_type: "group") }
  scope :for_user, ->(user_id) {
    joins(:chat_conversation_participants)
      .where(chat_conversation_participants: { user_id: user_id })
  }

  def display_name
    name.presence || users.pluck(:name).sort.join(", ")
  end

  def last_message
    chat_messages.order(created_at: :desc).first
  end

  def unread_count_for(user)
    participant = chat_conversation_participants.find_by(user_id: user.id)
    return 0 unless participant

    last_read = participant.last_read_at || Time.at(0)
    chat_messages.where("created_at > ?", last_read)
                 .where.not(user_id: user.id)
                 .count
  end

  def participant?(user)
    chat_conversation_participants.exists?(user_id: user.id)
  end
end
