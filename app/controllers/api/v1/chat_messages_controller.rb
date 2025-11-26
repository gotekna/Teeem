class Api::V1::ChatMessagesController < ApplicationController

  # GET /api/v1/chat_messages?channel=general
  # GET /api/v1/chat_messages?project_id=123
  # GET /api/v1/chat_messages?user_id=456
  def index
    if params[:project_id].present?
      @messages = ChatMessage.for_project(params[:project_id]).includes(:user).recent(100)
    elsif params[:user_id].present?
      # Direct messages between current user and specified user
      @messages = ChatMessage.between_users(current_user.id, params[:user_id]).includes(:user).recent(100)
    elsif params[:channel].present?
      @messages = ChatMessage.in_channel(params[:channel]).includes(:user).recent(100)
    else
      @messages = ChatMessage.general.includes(:user).recent(100)
    end

    render json: @messages.as_json(include: { user: { only: [:id, :name, :email] } }, methods: :formatted_timestamp)
  end

  # POST /api/v1/chat_messages
  def create
    @message = ChatMessage.new(message_params)
    @message.user = current_user

    if @message.save
      render json: @message.as_json(include: { user: { only: [:id, :name, :email] } }, methods: :formatted_timestamp), status: :created
    else
      render json: { errors: @message.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # DELETE /api/v1/chat_messages/:id
  def destroy
    @message = ChatMessage.find(params[:id])

    if @message.user_id == current_user.id
      @message.destroy
      head :no_content
    else
      render json: { error: 'Unauthorized' }, status: :forbidden
    end
  end

  # GET /api/v1/chat_messages/unread_count
  def unread_count
    last_read = current_user.last_chat_read_at || Time.at(0)
    count = ChatMessage.where('created_at > ?', last_read)
                      .where.not(user_id: current_user.id)
                      .count
    render json: { count: count }
  end

  # POST /api/v1/chat_messages/mark_as_read
  def mark_as_read
    current_user.update(last_chat_read_at: Time.current)
    head :no_content
  end

  # POST /api/v1/chat_messages/:id/save_to_job
  def save_to_job
    @message = ChatMessage.find(params[:id])
    construction_id = params[:job_id]

    if construction_id.blank?
      render json: { error: 'construction_id is required' }, status: :unprocessable_entity
      return
    end

    @message.update(construction_id: construction_id, saved_to_job: true)
    render json: @message.as_json(include: { user: { only: [:id, :name, :email] } }, methods: :formatted_timestamp)
  end

  # POST /api/v1/chat_messages/save_conversation_to_job
  def save_conversation_to_job
    construction_id = params[:job_id]
    message_ids = params[:message_ids]

    if construction_id.blank?
      render json: { error: 'construction_id is required' }, status: :unprocessable_entity
      return
    end

    if message_ids.blank? || !message_ids.is_a?(Array)
      render json: { error: 'message_ids must be an array' }, status: :unprocessable_entity
      return
    end

    # Update all messages in the conversation
    ChatMessage.where(id: message_ids).update_all(
      construction_id: construction_id,
      saved_to_job: true
    )

    # Return updated messages
    @messages = ChatMessage.where(id: message_ids).includes(:user).order(created_at: :asc)
    render json: @messages.as_json(include: { user: { only: [:id, :name, :email] } }, methods: :formatted_timestamp)
  end

  private

  def message_params
    params.require(:chat_message).permit(:content, :channel, :project_id, :recipient_user_id)
  end

end
