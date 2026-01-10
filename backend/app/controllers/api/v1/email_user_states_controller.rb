# frozen_string_literal: true

class Api::V1::EmailUserStatesController < ApplicationController
  before_action :set_email, only: [:show, :update, :toggle_pin, :toggle_star, :toggle_archive, :toggle_read, :set_reminder, :clear_reminder]

  # GET /api/v1/email_user_states
  # List emails with specific states (pinned, starred, archived)
  def index
    # Default to showing pinned
    filter = params[:filter] || "pinned"

    case filter
    when "pinned"
      emails = EmailUserState.pinned_emails_for(current_user)
    when "starred"
      emails = EmailUserState.starred_emails_for(current_user)
    when "archived"
      emails = EmailUserState.archived_emails_for(current_user)
    when "reminders"
      states = current_user.email_user_states.with_reminders.includes(:email_warehouse)
      return render json: {
        success: true,
        data: {
          reminders: states.map { |s| state_with_email_json(s) }
        }
      }
    else
      emails = EmailWarehouse.none
    end

    render json: {
      success: true,
      data: {
        filter: filter,
        emails: emails.map { |e| email_with_state_json(e) },
        count: emails.count
      }
    }
  end

  # GET /api/v1/email_user_states/for_email/:email_id
  # Get state for a specific email
  def show
    state = EmailUserState.find_by(email_warehouse: @email, user: current_user)

    render json: {
      success: true,
      data: state&.as_json || default_state(@email.id)
    }
  end

  # PATCH /api/v1/email_user_states/for_email/:email_id
  # Update state for an email
  def update
    state = EmailUserState.for(@email, current_user)

    if state.update(state_params)
      render json: {
        success: true,
        data: state.as_json
      }
    else
      render json: {
        success: false,
        error: state.errors.full_messages.join(", ")
      }, status: :unprocessable_entity
    end
  end

  # POST /api/v1/email_user_states/for_email/:email_id/toggle_pin
  def toggle_pin
    state = EmailUserState.toggle_pin!(@email, current_user)

    render json: {
      success: true,
      data: state.as_json,
      message: state.is_pinned ? "Email pinned" : "Email unpinned"
    }
  end

  # POST /api/v1/email_user_states/for_email/:email_id/toggle_star
  def toggle_star
    state = EmailUserState.toggle_star!(@email, current_user, color: params[:color])

    render json: {
      success: true,
      data: state.as_json,
      message: state.is_starred ? "Email starred" : "Email unstarred"
    }
  end

  # POST /api/v1/email_user_states/for_email/:email_id/toggle_archive
  def toggle_archive
    state = EmailUserState.toggle_archive!(@email, current_user)

    render json: {
      success: true,
      data: state.as_json,
      message: state.is_archived ? "Email archived" : "Email unarchived"
    }
  end

  # POST /api/v1/email_user_states/for_email/:email_id/toggle_read
  def toggle_read
    state = EmailUserState.toggle_read!(@email, current_user)

    # Sync read status to Office 365 (fire-and-forget, don't block on errors)
    sync_read_status_to_office365(@email, state.is_read)

    render json: {
      success: true,
      data: state.as_json,
      message: state.is_read ? "Marked as read" : "Marked as unread"
    }
  end

  # POST /api/v1/email_user_states/for_email/:email_id/set_reminder
  def set_reminder
    remind_at = Time.parse(params[:remind_at])
    state = EmailUserState.set_reminder!(@email, current_user, remind_at: remind_at)

    render json: {
      success: true,
      data: state.as_json,
      message: "Reminder set for #{remind_at.strftime('%b %d at %I:%M %p')}"
    }
  rescue ArgumentError
    render json: { success: false, error: "Invalid date format" }, status: :unprocessable_entity
  end

  # DELETE /api/v1/email_user_states/for_email/:email_id/clear_reminder
  def clear_reminder
    state = EmailUserState.clear_reminder!(@email, current_user)

    render json: {
      success: true,
      data: state.as_json,
      message: "Reminder cleared"
    }
  end

  # GET /api/v1/email_user_states/star_colors
  # Get available star colors
  def star_colors
    render json: {
      success: true,
      data: {
        colors: EmailUserState::STAR_COLORS.map { |k, v| { key: k.to_s, hex: v[:hex], label: v[:label] } }
      }
    }
  end

  # POST /api/v1/email_user_states/mark_folder_read
  # Mark all emails in a folder as read
  def mark_folder_read
    mailbox_email = params[:mailbox_email]
    folder_name = params[:folder_name] || "Inbox"

    return render json: { success: false, error: "mailbox_email required" }, status: :bad_request unless mailbox_email.present?

    # Find all unread emails in this folder
    # SSoT: Column is mailbox_owner_email, not mailbox_email
    emails = EmailWarehouse.where(mailbox_owner_email: mailbox_email)
                           .where("folder_name ILIKE ?", folder_name)

    affected = 0
    emails.find_each do |email|
      state = EmailUserState.for(email, current_user)
      unless state.is_read
        state.update!(is_read: true)
        sync_read_status_to_office365(email, true)
        affected += 1
      end
    end

    render json: {
      success: true,
      data: { affected_count: affected },
      message: "Marked #{affected} emails as read"
    }
  rescue ActiveRecord::RecordInvalid, ActiveRecord::RecordNotFound => e
    Rails.logger.error("[mark_folder_read] Validation error: #{e.message}")
    render json: { success: false, error: e.message }, status: :unprocessable_entity
  rescue StandardError => e
    Rails.logger.error("[mark_folder_read] Error: #{e.class} - #{e.message}")
    Rails.logger.error(e.backtrace.first(5).join("\n"))
    render json: { success: false, error: "Failed to mark folder as read: #{e.message}" }, status: :internal_server_error
  end

  # POST /api/v1/email_user_states/bulk_action
  # Apply action to multiple emails
  def bulk_action
    email_ids = params[:email_ids] || []
    action = params[:action_type]

    return render json: { success: false, error: "No emails provided" }, status: :bad_request if email_ids.empty?
    return render json: { success: false, error: "Invalid action" }, status: :bad_request unless %w[pin unpin star unstar archive unarchive mark_read mark_unread].include?(action)

    affected = 0

    email_ids.each do |email_id|
      email = EmailWarehouse.find_by(id: email_id)
      next unless email

      state = EmailUserState.for(email, current_user)

      case action
      when "pin"
        state.update!(is_pinned: true)
      when "unpin"
        state.update!(is_pinned: false)
      when "star"
        state.update!(is_starred: true, star_color: params[:color] || "yellow")
      when "unstar"
        state.update!(is_starred: false, star_color: nil)
      when "archive"
        state.update!(is_archived: true)
      when "unarchive"
        state.update!(is_archived: false)
      when "mark_read"
        state.update!(is_read: true)
        sync_read_status_to_office365(email, true)
      when "mark_unread"
        state.update!(is_read: false)
        sync_read_status_to_office365(email, false)
      end

      affected += 1
    end

    render json: {
      success: true,
      data: { affected_count: affected },
      message: "#{action.humanize} applied to #{affected} emails"
    }
  end

  private

  def set_email
    @email = EmailWarehouse.find(params[:email_id])
  end

  def state_params
    params.require(:state).permit(
      :is_pinned,
      :is_starred,
      :star_color,
      :is_read,
      :is_archived,
      :priority,
      :notes
    )
  end

  def default_state(email_id)
    {
      email_id: email_id,
      is_pinned: false,
      is_starred: false,
      star_color: nil,
      is_read: false,
      is_archived: false,
      priority: nil,
      remind_at: nil,
      notes: nil,
      from_vip: false
    }
  end

  def email_with_state_json(email)
    state = email.email_user_states.find_by(user: current_user)

    {
      id: email.id,
      subject: email.subject,
      from_email: email.from_email,
      from_name: email.from_name,
      received_at: email.received_at,
      has_attachments: email.has_attachments,
      snippet: email.preview_body(length: 150),
      state: state&.as_json || default_state(email.id)
    }
  end

  def state_with_email_json(state)
    {
      **state.as_json,
      email: {
        id: state.email_warehouse.id,
        subject: state.email_warehouse.subject,
        from_email: state.email_warehouse.from_email,
        from_name: state.email_warehouse.from_name,
        received_at: state.email_warehouse.received_at,
        snippet: state.email_warehouse.preview_body(length: 150)
      }
    }
  end

  # Sync read status back to Office 365 (fire-and-forget)
  # @param email [EmailWarehouse] The email record
  # @param is_read [Boolean] The read status to sync
  def sync_read_status_to_office365(email, is_read)
    return unless email.outlook_id.present? && email.mailbox_owner_email.present?
    return unless email.microsoft_credential_id.present?

    # Find the credential for this email's mailbox
    credential = MicrosoftCredential.find_by(id: email.microsoft_credential_id)
    return unless credential&.status == "connected"

    # Fire-and-forget - don't block the response on MS Graph call
    Thread.new do
      begin
        client = MicrosoftAppGraphClient.new(credential)
        client.mark_message_read(email.mailbox_owner_email, email.outlook_id, is_read: is_read)
        Rails.logger.info "[EmailSync] Synced read status to Office 365: #{email.id} -> #{is_read}"
      rescue StandardError => e
        # Don't fail the request if Office 365 sync fails
        Rails.logger.warn "[EmailSync] Failed to sync read status to Office 365 for email #{email.id}: #{e.message}"
      ensure
        ActiveRecord::Base.connection_pool.release_connection
      end
    end
  end
end
