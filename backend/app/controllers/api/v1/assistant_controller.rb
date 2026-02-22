# frozen_string_literal: true

# AI Assistant Controller
#
# Endpoints for the TEEEM AI Assistant chat interface.
# Phase 1: Web chat with tool use. Phase 2+: WhatsApp, SMS, Slack webhooks.
#
class Api::V1::AssistantController < ApplicationController
  before_action :authorize_request
  before_action :require_admin, only: [:status, :setup]

  # POST /api/v1/assistant/chat
  # Send a message to the assistant and get a response
  #
  # Params:
  #   message: String (required) - the user's message
  #   conversation_id: Integer (optional) - existing conversation ID
  #   content_type: String (optional) - "text" or "voice_transcript"
  #
  def chat
    message = params[:message]
    return render json: { success: false, error: "Message is required" }, status: :bad_request if message.blank?

    # Find or create conversation
    conversation = if params[:conversation_id].present?
      AssistantConversation.find_by(id: params[:conversation_id], user: current_user)
    end
    conversation ||= AssistantConversation.find_or_create_active(user: current_user, channel: "web")

    # Run through the assistant service
    service = AssistantService.new(user: current_user, tenant: current_tenant)
    result = service.chat(message: message, conversation: conversation)

    render json: {
      success: true,
      data: {
        conversation_id: conversation.id,
        content: result[:content],
        actions: result[:actions].map { |a| action_json(a) },
        tool_calls_made: result[:tool_calls_made].map { |t| t[:name] }
      }
    }
  end

  # GET /api/v1/assistant/conversations
  # List user's conversations
  def conversations
    conversations = AssistantConversation
      .where(user: current_user)
      .active
      .recent
      .limit(20)

    render json: {
      success: true,
      data: conversations.map { |c| conversation_json(c) }
    }
  end

  # GET /api/v1/assistant/conversations/:id/history
  # Get conversation message history
  def history
    conversation = AssistantConversation.find_by(id: params[:id], user: current_user)
    return render json: { success: false, error: "Conversation not found" }, status: :not_found unless conversation

    messages = conversation.assistant_messages
      .order(created_at: :asc)
      .last(100)

    render json: {
      success: true,
      data: {
        conversation: conversation_json(conversation),
        messages: messages.map { |m| message_json(m) }
      }
    }
  end

  # POST /api/v1/assistant/conversations/new
  # Start a new conversation
  def new_conversation
    conversation = AssistantConversation.create!(
      user: current_user,
      tenant_id: current_user.tenant_id,
      channel: "web",
      title: params[:title] || "New conversation",
      last_message_at: Time.current
    )

    render json: {
      success: true,
      data: conversation_json(conversation)
    }, status: :created
  end

  # GET /api/v1/assistant/actions
  # List pending actions that need user approval
  def actions
    actions = AssistantAction
      .where(user: current_user)
      .where(status: params[:status] || "pending")
      .order(created_at: :desc)
      .limit(20)

    render json: {
      success: true,
      data: actions.map { |a| action_json(a) }
    }
  end

  # POST /api/v1/assistant/actions/:id/approve
  # Approve a pending action (execute it)
  def approve_action
    action = AssistantAction.find_by(id: params[:id], user: current_user)
    return render json: { success: false, error: "Action not found" }, status: :not_found unless action
    return render json: { success: false, error: "Action is not pending" }, status: :unprocessable_entity unless action.status == "pending"

    result = execute_approved_action(action)

    # Record feedback for learning (Phase 5)
    AssistantLearningService.new(user: current_user).record_feedback(action_id: action.id, approved: true)

    render json: {
      success: true,
      data: action_json(action.reload)
    }
  end

  # POST /api/v1/assistant/actions/:id/reject
  # Reject a pending action
  def reject_action
    action = AssistantAction.find_by(id: params[:id], user: current_user)
    return render json: { success: false, error: "Action not found" }, status: :not_found unless action

    action.reject!

    # Record feedback for learning (Phase 5)
    AssistantLearningService.new(user: current_user).record_feedback(action_id: action.id, approved: false)

    render json: { success: true, data: action_json(action) }
  end

  # GET /api/v1/assistant/alerts
  # Get active alerts for the user
  def alerts
    alerts = AssistantAlert
      .where(user: current_user)
      .active
      .order(created_at: :desc)
      .limit(20)

    render json: {
      success: true,
      data: alerts.map { |a| alert_json(a) }
    }
  end

  # GET /api/v1/assistant/preferences
  # Get user's assistant preferences (learned + configured)
  def preferences
    learning = AssistantLearningService.new(user: current_user)
    render json: { success: true, data: learning.current_preferences }
  end

  # PUT /api/v1/assistant/preferences
  # Update user's assistant preferences
  def update_preferences
    allowed = params.permit(
      notification_channels: [],
      quiet_hours: [:start, :end],
      autopilot_actions: []
    ).to_h

    allowed[:autopilot_enabled] = params[:autopilot_enabled] if params.key?(:autopilot_enabled)

    prefs = current_user.assistant_preferences || {}
    prefs.merge!(allowed.stringify_keys)
    current_user.update!(assistant_preferences: prefs)

    render json: { success: true, data: prefs }
  end

  # GET /api/v1/assistant/cross_channel/:contact_id
  # Get cross-channel communication context for a contact
  def cross_channel_context
    contact = Contact.find_by(id: params[:contact_id])
    return render json: { success: false, error: "Contact not found" }, status: :not_found unless contact

    service = CrossChannelContextService.new(user: current_user, tenant: current_tenant)
    context = service.unified_context_for(contact: contact, hours: (params[:hours] || 72).to_i)

    render json: {
      success: true,
      data: {
        contact: { id: contact.id, name: contact.display_name },
        channels: context[:channels],
        message_count: context[:messages].size,
        topic_clusters: context[:topic_clusters].map { |tc|
          { channels: tc[:channels], message_count: tc[:messages].size, timespan_hours: tc[:timespan_hours] }
        },
        summary: context[:summary],
        messages: context[:messages].last(20).map { |m|
          { channel: m[:channel], content: m[:content]&.truncate(300), timestamp: m[:timestamp], from: m[:from] }
        }
      }
    }
  end

  # POST /api/v1/assistant/alerts/:id/dismiss
  # Dismiss an alert
  def dismiss_alert
    alert = AssistantAlert.find_by(id: params[:id], user: current_user)
    return render json: { success: false, error: "Alert not found" }, status: :not_found unless alert

    alert.dismiss!

    render json: { success: true }
  end

  # GET /api/v1/assistant/status
  # Returns connection status for all AI assistant services. Admin only.
  def status
    settings = TenantSetting.instance

    render json: {
      success: true,
      data: {
        claude: {
          connected: ENV["ANTHROPIC_API_KEY"].present?,
          model: ENV["ANTHROPIC_API_KEY"].present? ? (ENV["ANTHROPIC_MODEL"] || "claude-sonnet-4-5-20250929") : nil
        },
        twilio: {
          connected: settings&.twilio_enabled? && settings&.twilio_account_sid.present?,
          phone: settings&.twilio_enabled? ? settings&.twilio_phone_number : nil
        },
        deepgram: {
          connected: deepgram_api_key_present?(settings)
        },
        slack: {
          connected: slack_configured?(settings),
          bot_name: slack_configured?(settings) ? "TEEEM" : nil
        },
        signal: {
          connected: ENV["SIGNAL_CLI_REST_API_URL"].present?
        },
        assistant_enabled: settings&.assistant_enabled || false
      }
    }
  end

  # PUT /api/v1/assistant/setup
  # Save AI assistant service credentials to TenantSetting. Admin only.
  def setup
    settings = TenantSetting.instance
    return render json: { success: false, error: "Tenant settings not found" }, status: :not_found unless settings

    permitted = params.permit(:deepgram_api_key, :slack_bot_token, :slack_signing_secret, :assistant_enabled)
    updates = {}

    updates[:deepgram_api_key] = permitted[:deepgram_api_key] if permitted.key?(:deepgram_api_key)
    updates[:slack_bot_token] = permitted[:slack_bot_token] if permitted.key?(:slack_bot_token)
    updates[:slack_signing_secret] = permitted[:slack_signing_secret] if permitted.key?(:slack_signing_secret)
    updates[:assistant_enabled] = permitted[:assistant_enabled] if permitted.key?(:assistant_enabled)

    if settings.update(updates)
      render json: { success: true, data: { updated: updates.keys } }
    else
      render json: { success: false, error: settings.errors.full_messages.join(", ") }, status: :unprocessable_entity
    end
  end

  private

  def deepgram_api_key_present?(settings)
    settings&.deepgram_api_key.present? || ENV["DEEPGRAM_API_KEY"].present?
  end

  def slack_configured?(settings)
    (settings&.slack_bot_token.present? && settings&.slack_signing_secret.present?) ||
      (ENV["SLACK_BOT_TOKEN"].present? && ENV["SLACK_SIGNING_SECRET"].present?)
  end

  # Execute an approved action
  def execute_approved_action(action)
    action.approve!

    case action.action_type
    when "create_task"
      execute_create_task(action)
    when "update_task"
      execute_update_task(action)
    when "draft_email"
      # For now, just mark as executed. Phase 2 will integrate with EmailSendingService.
      action.execute!(note: "Email draft saved. Open in email compose to send.")
    when "draft_sms"
      execute_send_sms(action)
    when "send_whatsapp"
      execute_send_whatsapp(action)
    when "send_slack"
      execute_send_slack(action)
    else
      action.execute!(note: "Action approved")
    end
  rescue StandardError => e
    action.fail!(e.message)
  end

  def execute_create_task(action)
    data = action.action_data.with_indifferent_access
    max_standalone = SmTask.where(job_id: nil).maximum(:task_number) || 9999

    task = SmTask.create!(
      name: data[:name],
      description: data[:description],
      start_date: data[:start_date] || Date.current,
      end_date: data[:end_date] || Date.current + 1.day,
      duration_days: data[:duration_days] || 1,
      status: "not_started",
      task_number: max_standalone + 1,
      sequence_order: 1,
      job_id: data[:job_id],
      assigned_user_id: data[:assigned_user_id] || current_user.id,
      created_by: current_user,
      tenant_id: current_user.tenant_id
    )

    action.execute!(task_id: task.id, task_name: task.name)
  end

  def execute_update_task(action)
    data = action.action_data.with_indifferent_access
    task = SmTask.find(data[:task_id])
    updates = data[:updates]&.with_indifferent_access || {}
    updates[:updated_by_id] = current_user.id

    task.update!(updates)
    action.execute!(task_id: task.id, updated_fields: updates.keys)
  end

  def execute_send_sms(action)
    data = action.action_data.with_indifferent_access
    contact = Contact.find_by(id: data[:contact_id])
    to_phone = data[:to]

    if contact
      result = TwilioService.send_sms(
        to: to_phone || contact.primary_mobile,
        body: data[:body],
        contact: contact,
        user: current_user
      )
      if result[:success]
        action.execute!(sms_id: result[:sms]&.id, note: "SMS sent")
      else
        action.fail!(result[:error])
      end
    else
      action.execute!(note: "SMS draft saved. Contact not found for auto-send.")
    end
  end

  def execute_send_whatsapp(action)
    data = action.action_data.with_indifferent_access
    settings = TenantSetting.instance

    unless settings&.twilio_enabled?
      action.fail!("Twilio not configured")
      return
    end

    to_phone = data[:to]
    client = Twilio::REST::Client.new(settings.twilio_account_sid, settings.twilio_auth_token)

    msg = client.messages.create(
      from: "whatsapp:#{settings.twilio_phone_number}",
      to: "whatsapp:#{TwilioService.send(:normalize_phone_number, to_phone)}",
      body: data[:body].truncate(4000)
    )

    action.execute!(twilio_sid: msg.sid, note: "WhatsApp sent")
  rescue Twilio::REST::RestError => e
    action.fail!(e.message)
  end

  def execute_send_slack(action)
    data = action.action_data.with_indifferent_access

    unless SlackIntegrationService.configured?
      action.fail!("Slack not configured")
      return
    end

    result = SlackIntegrationService.send_message(
      channel_id: data[:channel_or_user],
      text: data[:body]
    )

    if result
      action.execute!(note: "Slack message sent")
    else
      action.fail!("Failed to send Slack message")
    end
  end

  # ========================================
  # JSON serializers
  # ========================================

  def conversation_json(conv)
    {
      id: conv.id,
      title: conv.title,
      channel: conv.channel,
      status: conv.status,
      last_message_at: conv.last_message_at,
      created_at: conv.created_at
    }
  end

  def message_json(msg)
    {
      id: msg.id,
      role: msg.role,
      content: msg.content,
      content_type: msg.content_type,
      tool_calls: msg.tool_calls.presence,
      created_at: msg.created_at
    }
  end

  def action_json(action)
    {
      id: action.id,
      action_type: action.action_type,
      status: action.status,
      description: action.description,
      action_data: action.action_data,
      result_data: action.result_data,
      created_at: action.created_at,
      approved_at: action.approved_at,
      executed_at: action.executed_at
    }
  end

  def alert_json(alert)
    {
      id: alert.id,
      alert_type: alert.alert_type,
      priority: alert.priority,
      status: alert.status,
      title: alert.title,
      summary: alert.summary,
      context_data: alert.context_data,
      created_at: alert.created_at
    }
  end
end
