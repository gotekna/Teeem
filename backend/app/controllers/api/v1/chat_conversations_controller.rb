class Api::V1::ChatConversationsController < ApplicationController
  before_action :set_conversation, only: [ :update, :add_participant, :remove_participant ]

  # POST /api/v1/chat_conversations
  def create
    conv_params = params[:chat_conversation] || params

    conversation = ChatConversation.new(
      name: conv_params[:name],
      conversation_type: "group",
      creator: current_user,
      tenant: current_tenant
    )

    if conversation.save
      # Add creator as admin participant
      conversation.chat_conversation_participants.create!(
        user_id: current_user.id,
        is_admin: true,
        last_read_at: Time.current
      )

      # Add other participants
      participant_ids = Array(conv_params[:participant_ids]).map(&:to_i) - [ current_user.id ]
      participant_ids.each do |user_id|
        conversation.chat_conversation_participants.create!(
          user_id: user_id,
          last_read_at: Time.current
        )
      end

      render json: conversation_json(conversation), status: :created
    else
      render json: { errors: conversation.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # PATCH /api/v1/chat_conversations/:id
  def update
    if @conversation.update(name: params[:name])
      render json: conversation_json(@conversation)
    else
      render json: { errors: @conversation.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # POST /api/v1/chat_conversations/:id/add_participant
  def add_participant
    user_id = params[:user_id].to_i

    if @conversation.chat_conversation_participants.exists?(user_id: user_id)
      render json: { error: "User is already a participant" }, status: :unprocessable_entity
      return
    end

    @conversation.chat_conversation_participants.create!(
      user_id: user_id,
      last_read_at: Time.current
    )

    render json: conversation_json(@conversation)
  end

  # POST /api/v1/chat_conversations/:id/remove_participant
  def remove_participant
    user_id = params[:user_id].to_i
    participant = @conversation.chat_conversation_participants.find_by(user_id: user_id)

    if participant.nil?
      render json: { error: "User is not a participant" }, status: :not_found
      return
    end

    participant.destroy
    render json: conversation_json(@conversation)
  end

  private

  def set_conversation
    @conversation = ChatConversation.find(params[:id])
    unless @conversation.participant?(current_user)
      render json: { error: "Not a participant" }, status: :forbidden
    end
  end

  def conversation_json(conversation)
    last_msg = conversation.last_message

    {
      id: "group-#{conversation.id}",
      type: "group",
      name: conversation.display_name,
      participants: conversation.chat_conversation_participants.includes(:user).map { |p|
        last_seen = p.user.last_seen_at
        {
          id: p.user.id,
          name: p.user.name,
          is_online: last_seen.present? && last_seen > 5.minutes.ago,
          is_admin: p.is_admin
        }
      },
      last_message: last_msg ? {
        id: last_msg.id,
        content: last_msg.content,
        sender_id: last_msg.user_id,
        sender_name: last_msg.user_id == current_user.id ? "You" : last_msg.user&.name,
        created_at: last_msg.created_at,
        is_own: last_msg.user_id == current_user.id
      } : nil,
      unread_count: conversation.unread_count_for(current_user),
      is_pinned: false,
      updated_at: last_msg&.created_at || conversation.created_at
    }
  end
end
