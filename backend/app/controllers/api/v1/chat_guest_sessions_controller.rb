# frozen_string_literal: true

# Guest Chat API - No authentication required for guest endpoints (the token IS the auth)
#
# Host endpoints (authenticated):
#   POST   /api/v1/chat_guest_sessions           - Create a guest link
#   GET    /api/v1/chat_guest_sessions           - List my guest sessions
#   DELETE /api/v1/chat_guest_sessions/:id       - Close a guest session
#
# Guest endpoints (token = auth, :id = token):
#   GET    /api/v1/chat_guest_sessions/:token           - Get session info
#   POST   /api/v1/chat_guest_sessions/:token/join      - Guest joins session
#   GET    /api/v1/chat_guest_sessions/:token/messages   - Get messages
#   POST   /api/v1/chat_guest_sessions/:token/send_message - Send message
#
class Api::V1::ChatGuestSessionsController < ApplicationController
  # Guest endpoints skip auth - the token is the authentication
  skip_before_action :authorize_request, only: [:show, :join, :messages, :send_message]
  skip_before_action :set_tenant, only: [:show, :join, :messages, :send_message]

  # POST /api/v1/chat_guest_sessions
  # Create a new guest chat link (authenticated - host user)
  def create
    session = ChatGuestSession.create_for_user!(current_user)

    render json: {
      success: true,
      data: {
        id: session.id,
        token: session.token,
        share_url: session.share_url,
        expires_at: session.expires_at,
        status: session.status
      }
    }, status: :created
  end

  # GET /api/v1/chat_guest_sessions/:token
  # Get session info (no auth - guest uses this to see host info before joining)
  def show
    session = find_guest_session!

    render json: {
      success: true,
      data: {
        status: session.status,
        host_name: session.host_user&.name,
        host_initials: session.host_user&.initials,
        guest_name: session.guest_name,
        expires_at: session.expires_at,
        active: session.active?
      }
    }
  rescue ActiveRecord::RecordNotFound => e
    render json: { success: false, error: e.message }, status: :not_found
  end

  # POST /api/v1/chat_guest_sessions/:token/join
  # Guest joins the chat (sets their name)
  def join
    session = find_guest_session!
    session.join!(params[:name], params[:email])

    render json: {
      success: true,
      data: {
        status: session.status,
        guest_name: session.guest_name,
        host_name: session.host_user&.name
      }
    }
  rescue ActiveRecord::RecordNotFound => e
    render json: { success: false, error: e.message }, status: :not_found
  end

  # GET /api/v1/chat_guest_sessions/:token/messages
  # Get messages in this guest session (no auth)
  def messages
    session = find_guest_session!

    ActsAsTenant.with_tenant(session.tenant) do
      msgs = ChatMessage
        .where(chat_guest_session_id: session.id)
        .includes(:user)
        .order(created_at: :asc)
        .limit(200)

      render json: {
        success: true,
        data: msgs.map { |m| guest_message_json(m) }
      }
    end
  rescue ActiveRecord::RecordNotFound => e
    render json: { success: false, error: e.message }, status: :not_found
  end

  # POST /api/v1/chat_guest_sessions/:token/send_message
  # Guest sends a message (no auth - token is auth)
  def send_message
    session = find_guest_session!

    unless session.active?
      return render json: { success: false, error: "Please join the chat first" }, status: :unprocessable_entity
    end

    ActsAsTenant.with_tenant(session.tenant) do
      message = ChatMessage.new(
        content: params[:content],
        chat_guest_session: session,
        guest_sender_name: session.guest_name,
        channel: "guest",
        tenant_id: session.tenant_id
      )

      if message.save
        render json: {
          success: true,
          data: guest_message_json(message)
        }, status: :created
      else
        render json: { success: false, error: message.errors.full_messages.join(", ") }, status: :unprocessable_entity
      end
    end
  rescue ActiveRecord::RecordNotFound => e
    render json: { success: false, error: e.message }, status: :not_found
  end

  # DELETE /api/v1/chat_guest_sessions/:id
  # Close a guest session (authenticated - host user)
  def destroy
    session = ChatGuestSession.find(params[:id])
    session.update!(status: "closed")
    render json: { success: true, message: "Chat link closed" }
  end

  # GET /api/v1/chat_guest_sessions
  # List host's active guest sessions (authenticated)
  def index
    sessions = ChatGuestSession.where(host_user: current_user).order(created_at: :desc).limit(20)

    render json: {
      success: true,
      data: sessions.map { |s|
        {
          id: s.id,
          token: s.token,
          share_url: s.share_url,
          guest_name: s.guest_name,
          status: s.status,
          created_at: s.created_at,
          expires_at: s.expires_at,
          message_count: s.chat_messages.count
        }
      }
    }
  end

  private

  # Find guest session by token (used by all guest-facing endpoints)
  # Routes use :id for show, and :id for member actions
  def find_guest_session!
    token = params[:id]
    ChatGuestSession.unscoped.find_by_token!(token)
  end

  def guest_message_json(msg)
    {
      id: msg.id,
      content: msg.content,
      sender_name: msg.sender_display_name,
      is_guest: msg.guest_message?,
      is_host: msg.user_id.present?,
      created_at: msg.created_at,
      formatted_timestamp: msg.formatted_timestamp
    }
  end
end
