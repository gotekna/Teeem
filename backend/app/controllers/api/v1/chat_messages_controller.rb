class Api::V1::ChatMessagesController < ApplicationController
  # GET /api/v1/chat_messages/online_users
  # Returns list of users with their online status
  def online_users
    users = User.where.not(id: current_user.id)
                .order(:name)

    render json: users.map { |user|
      last_seen = user.last_seen_at
      presence_status = if last_seen.nil?
                          "offline"
      elsif last_seen > 5.minutes.ago
                          "online"
      elsif last_seen > 30.minutes.ago
                          "away"
      else
                          "offline"
      end

      {
        id: user.id,
        name: user.name,
        email: user.email,
        presence_status: presence_status,
        is_online: presence_status == "online",
        last_seen_at: user.last_seen_at
      }
    }
  end

  # GET /api/v1/chat_messages/conversations
  # Returns list of conversations for current user
  def conversations
    # Get all direct message conversations for current user
    direct_messages = ChatMessage
      .where("user_id = ? OR recipient_user_id = ?", current_user.id, current_user.id)
      .where.not(recipient_user_id: nil)
      .select("DISTINCT ON (LEAST(user_id, recipient_user_id), GREATEST(user_id, recipient_user_id)) *")
      .order(Arel.sql("LEAST(user_id, recipient_user_id), GREATEST(user_id, recipient_user_id), created_at DESC"))

    # Get unique conversation partner IDs
    partner_ids = direct_messages.flat_map { |m| [ m.user_id, m.recipient_user_id ] }.uniq - [ current_user.id ]
    partners = User.where(id: partner_ids).index_by(&:id)

    conversations = direct_messages.map do |msg|
      partner_id = msg.user_id == current_user.id ? msg.recipient_user_id : msg.user_id
      partner = partners[partner_id]
      next unless partner

      last_seen = partner.last_seen_at
      is_online = last_seen.present? && last_seen > 5.minutes.ago

      {
        id: "dm-#{[ current_user.id, partner_id ].sort.join('-')}",
        type: "direct",
        name: partner.name,
        participants: [
          { id: current_user.id, name: current_user.name, is_online: true },
          { id: partner.id, name: partner.name, is_online: is_online }
        ],
        last_message: {
          id: msg.id,
          content: msg.content,
          sender_id: msg.user_id,
          sender_name: msg.user_id == current_user.id ? "You" : partner.name,
          created_at: msg.created_at,
          is_own: msg.user_id == current_user.id
        },
        unread_count: ChatMessage.where(user_id: partner_id, recipient_user_id: current_user.id)
                                 .where("created_at > ?", current_user.last_chat_read_at || Time.at(0))
                                 .count,
        is_pinned: false,
        job_id: nil,
        job_name: nil,
        updated_at: msg.created_at
      }
    end.compact

    # Sort by most recent message
    conversations.sort_by! { |c| c[:updated_at] }.reverse!

    render json: { conversations: conversations }
  end

  # GET /api/v1/chat_messages?channel=general
  # GET /api/v1/chat_messages?project_id=123
  # GET /api/v1/chat_messages?user_id=456
  # GET /api/v1/chat_messages?job_id=789
  # GET /api/v1/chat_messages?contact_id=101
  # GET /api/v1/chat_messages?case_id=102
  def index
    # Disable HTTP caching for real-time chat
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"

    if params[:job_id].present?
      @messages = ChatMessage.for_job(params[:job_id]).includes(:user).recent(100)
    elsif params[:contact_id].present?
      @messages = ChatMessage.for_contact(params[:contact_id]).includes(:user).recent(100)
    elsif params[:case_id].present?
      @messages = ChatMessage.for_case(params[:case_id]).includes(:user).recent(100)
    elsif params[:project_id].present?
      @messages = ChatMessage.for_project(params[:project_id]).includes(:user).recent(100)
    elsif params[:user_id].present?
      # Direct messages between current user and specified user
      @messages = ChatMessage.between_users(current_user.id, params[:user_id]).includes(:user).recent(100)
    elsif params[:channel].present?
      @messages = ChatMessage.in_channel(params[:channel]).includes(:user).recent(100)
    else
      @messages = ChatMessage.general.includes(:user).recent(100)
    end

    messages_with_files = @messages.map do |msg|
      json = msg.as_json(include: { user: {} }, methods: :formatted_timestamp)
      if msg.sharepoint_file_id.present?
        json[:has_file] = true
        json[:sharepoint_file_id] = msg.sharepoint_file_id
        json[:file_name] = msg.file_name
      end
      json
    end
    render json: messages_with_files
  end

  # POST /api/v1/chat_messages
  def create
    @message = ChatMessage.new(message_params)
    @message.user = current_user

    # Handle file attachment if present
    if params[:chat_message][:file].present?
      @message.file.attach(params[:chat_message][:file])
      @message.file_name = params[:chat_message][:file].original_filename
      @message.message_type ||= "file"
    end

    if @message.save
      # SharePoint upload happens via after_commit callback
      response_data = @message.as_json(include: { user: {} }, methods: :formatted_timestamp)
      if @message.file.attached?
        # File is being uploaded to SharePoint async
        response_data[:has_file] = true
        response_data[:file_name] = @message.file_name
        response_data[:upload_pending] = @message.sharepoint_file_id.blank?
      end
      render json: response_data, status: :created
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
      render json: { error: "Unauthorized" }, status: :forbidden
    end
  end

  # GET /api/v1/chat_messages/unread_count
  def unread_count
    last_read = current_user.last_chat_read_at || Time.at(0)
    count = ChatMessage.where("created_at > ?", last_read)
                      .where(recipient_user_id: current_user.id)
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
      render json: { error: "construction_id is required" }, status: :unprocessable_entity
      return
    end

    @message.update(construction_id: construction_id, saved_to_job: true)
    render json: @message.as_json(include: { user: {} }, methods: :formatted_timestamp)
  end

  # POST /api/v1/chat_messages/save_conversation_to_job
  def save_conversation_to_job
    construction_id = params[:job_id]
    message_ids = params[:message_ids]

    if construction_id.blank?
      render json: { error: "construction_id is required" }, status: :unprocessable_entity
      return
    end

    if message_ids.blank? || !message_ids.is_a?(Array)
      render json: { error: "message_ids must be an array" }, status: :unprocessable_entity
      return
    end

    # Update all messages in the conversation
    ChatMessage.where(id: message_ids).update_all(
      construction_id: construction_id,
      saved_to_job: true
    )

    # Return updated messages
    @messages = ChatMessage.where(id: message_ids).includes(:user).order(created_at: :asc)
    render json: @messages.as_json(include: { user: {} }, methods: :formatted_timestamp)
  end

  private

  def message_params
    params.require(:chat_message).permit(:content, :channel, :project_id, :recipient_user_id, :job_id, :contact_id, :case_id, :message_type, :file)
  end
end
