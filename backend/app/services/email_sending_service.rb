# frozen_string_literal: true

# EmailSendingService - Unified SSoT for all email sending operations
#
# This service provides a single entry point for sending emails across all account types:
# - IMAP/SMTP (via ImapEmailService)
# - Outlook Personal (via OutlookService)
# - MS365 Organization (via MicrosoftAppGraphClient)
#
# Usage:
#   EmailSendingService.send(
#     account_type: "imap",
#     credential_id: 123,
#     user: current_user,
#     to: ["recipient@example.com"],
#     subject: "Hello",
#     body: "<p>Email body</p>",
#     cc: [],
#     bcc: [],
#     attachments: [],
#     from_address: "alias@example.com",  # Optional, for IMAP aliases
#     reply_to_message_id: nil,           # Optional, for threading
#     mailbox_email: nil                  # Required for MS365
#   )
#
# For scheduled emails:
#   EmailSendingService.schedule(
#     ...same params as send...,
#     scheduled_for: 1.hour.from_now
#   )
#
class EmailSendingService
  # Reference account types from the SSoT concern (but don't include it - we're not an AR model)
  ACCOUNT_TYPES = EmailAccountTypes::ACCOUNT_TYPES

  class SendError < StandardError; end
  class InvalidAccountError < SendError; end
  class CredentialNotFoundError < SendError; end
  class AuthenticationError < SendError; end

  # Standardized send parameters
  SendParams = Struct.new(
    :account_type,
    :credential_id,
    :user,
    :to,
    :cc,
    :bcc,
    :subject,
    :body,
    :attachments,
    :from_address,
    :reply_to_message_id,
    :mailbox_email,
    keyword_init: true
  ) do
    def to_list
      Array(to).reject(&:blank?)
    end

    def cc_list
      Array(cc).reject(&:blank?)
    end

    def bcc_list
      Array(bcc).reject(&:blank?)
    end

    def attachments_list
      Array(attachments)
    end
  end

  # Result object for consistent return format
  Result = Struct.new(:success, :message_id, :error, :data, keyword_init: true) do
    def success?
      success == true
    end

    def to_h
      {
        success: success,
        message_id: message_id,
        error: error,
        data: data
      }.compact
    end
  end

  class << self
    # Send email immediately
    # @param params [Hash] Email parameters (see SendParams)
    # @return [Result] Send result with success status
    def send(**params)
      new(params).send_email
    end

    # Schedule email for later delivery
    # @param params [Hash] Email parameters plus :scheduled_for
    # @return [Result] Schedule result with scheduled email ID
    def schedule(**params)
      new(params).schedule_email
    end

    # Send email and log to EmailWarehouse
    # @param params [Hash] Email parameters
    # @return [Result] Send result
    def send_and_log(**params)
      service = new(params)
      result = service.send_email
      service.log_to_warehouse(result) if result.success?
      result
    end
  end

  def initialize(params)
    @params = normalize_params(params)
    @account_type = @params.account_type&.to_s
    validate_account_type!
  end

  # Send email via appropriate service
  def send_email
    case @account_type
    when "imap"
      send_via_imap
    when "outlook"
      send_via_outlook
    when "ms365"
      send_via_ms365
    else
      Result.new(success: false, error: "Unknown account type: #{@account_type}")
    end
  rescue CredentialNotFoundError => e
    Result.new(success: false, error: e.message)
  rescue AuthenticationError => e
    Result.new(success: false, error: "Authentication failed: #{e.message}")
  rescue StandardError => e
    Rails.logger.error("[EmailSendingService] Send failed: #{e.message}")
    Result.new(success: false, error: e.message)
  end

  # Schedule email for later delivery
  def schedule_email
    scheduled_for = @params_raw[:scheduled_for]
    raise SendError, "scheduled_for is required" unless scheduled_for.present?

    scheduled_time = scheduled_for.is_a?(String) ? Time.zone.parse(scheduled_for) : scheduled_for
    raise SendError, "Scheduled time must be in the future" if scheduled_time <= Time.current

    scheduled = ScheduledEmail.create!(
      imap_credential_id: imap_credential_id,
      microsoft_credential_id: ms365_credential_id,
      account_type: @account_type,
      mailbox_email: @params.mailbox_email,
      created_by: @params.user,
      to_addresses: @params.to_list.to_json,
      cc_addresses: @params.cc_list.to_json,
      bcc_addresses: @params.bcc_list.to_json,
      subject: @params.subject,
      body: @params.body,
      reply_to_message_id: @params.reply_to_message_id,
      scheduled_for: scheduled_time,
      status: "pending"
    )

    Result.new(
      success: true,
      data: {
        id: scheduled.id,
        scheduled_for: scheduled.scheduled_for,
        status: scheduled.status
      }
    )
  rescue ActiveRecord::RecordInvalid => e
    Result.new(success: false, error: e.message)
  rescue StandardError => e
    Rails.logger.error("[EmailSendingService] Schedule failed: #{e.message}")
    Result.new(success: false, error: e.message)
  end

  # Log sent email to EmailWarehouse
  def log_to_warehouse(result)
    return unless result.success?

    EmailWarehouse.create!(
      internet_message_id: result.message_id || SecureRandom.uuid,
      source_type: @account_type,
      imap_credential_id: imap_credential_id,
      subject: @params.subject,
      body_html: @params.body,
      body_text: ActionController::Base.helpers.strip_tags(@params.body),
      from_email: sender_email,
      from_name: @params.user&.name,
      to_emails: @params.to_list,
      cc_emails: @params.cc_list,
      received_at: Time.current,
      sent_at: Time.current,
      folder_name: "Sent",
      first_synced_at: Time.current,
      last_synced_at: Time.current,
      synced_by_user: @params.user
    )
  rescue StandardError => e
    Rails.logger.warn("[EmailSendingService] Failed to log to warehouse: #{e.message}")
  end

  private

  def normalize_params(params)
    @params_raw = params.dup
    SendParams.new(
      account_type: params[:account_type],
      credential_id: params[:credential_id],
      user: params[:user],
      to: params[:to],
      cc: params[:cc],
      bcc: params[:bcc],
      subject: params[:subject],
      body: params[:body],
      attachments: params[:attachments],
      from_address: params[:from_address],
      reply_to_message_id: params[:reply_to_message_id],
      mailbox_email: params[:mailbox_email]
    )
  end

  def validate_account_type!
    return if ACCOUNT_TYPES.include?(@account_type)

    # Try to infer from credential_id
    if @params.credential_id.to_s == "outlook"
      @account_type = "outlook"
    elsif @params.credential_id.to_s.start_with?("ms365_")
      @account_type = "ms365"
    elsif @params.credential_id.present?
      @account_type = "imap"
    else
      raise InvalidAccountError, "Invalid account type: #{@account_type}"
    end
  end

  # IMAP sending
  def send_via_imap
    credential = find_imap_credential
    service = ImapEmailService.new(credential)

    mail = service.send_email(
      to: @params.to_list,
      cc: @params.cc_list,
      bcc: @params.bcc_list,
      subject: @params.subject,
      body: @params.body,
      attachments: normalize_attachments_for_imap,
      reply_to_message_id: @params.reply_to_message_id,
      from_address: @params.from_address
    )

    Result.new(
      success: true,
      message_id: mail.message_id,
      data: { to: mail.to, subject: mail.subject }
    )
  end

  # Outlook (personal) sending
  def send_via_outlook
    user = @params.user
    raise CredentialNotFoundError, "User required for Outlook" unless user

    unless user.outlook_credential&.valid_credential?
      raise AuthenticationError, "Outlook not connected or token expired"
    end

    outlook = OutlookService.new(user)

    result = outlook.send_email(
      to: @params.to_list,
      cc: @params.cc_list,
      bcc: @params.bcc_list,
      subject: @params.subject,
      body: @params.body,
      attachments: normalize_attachments_for_graph
    )

    if result[:success]
      Result.new(success: true, message_id: result[:message_id])
    else
      Result.new(success: false, error: result[:error])
    end
  end

  # MS365 (organization) sending
  def send_via_ms365
    credential = find_ms365_credential
    client = MicrosoftAppGraphClient.new(credential)

    # Determine from address (mailbox_email for shared mailbox, or credential email)
    from_email = @params.mailbox_email.presence || credential.email

    result = client.send_email(
      from: from_email,
      to: @params.to_list,
      cc: @params.cc_list,
      bcc: @params.bcc_list,
      subject: @params.subject,
      body: @params.body,
      attachments: normalize_attachments_for_graph
    )

    if result[:success] || result.is_a?(Hash) && result[:success] != false
      Result.new(success: true, message_id: result[:message_id] || SecureRandom.uuid)
    else
      Result.new(success: false, error: result[:error] || "Failed to send via MS365")
    end
  end

  # Credential lookups
  def find_imap_credential
    user = @params.user
    credential_id = imap_credential_id

    credential = if user
                   user.imap_credentials.find_by(id: credential_id)
                 else
                   ImapCredential.find_by(id: credential_id)
                 end

    raise CredentialNotFoundError, "IMAP credential not found" unless credential
    credential
  end

  def find_ms365_credential
    credential_id = ms365_credential_id
    credential = MicrosoftCredential.find_by(id: credential_id)

    raise CredentialNotFoundError, "MS365 credential not found" unless credential
    credential
  end

  def imap_credential_id
    return nil unless @account_type == "imap"
    @params.credential_id
  end

  def ms365_credential_id
    return nil unless @account_type == "ms365"

    # Handle "ms365_123_hash" format from frontend
    cred_id = @params.credential_id.to_s
    if cred_id.start_with?("ms365_")
      cred_id.split("_")[1]
    else
      cred_id
    end
  end

  def sender_email
    case @account_type
    when "imap"
      @params.from_address.presence || find_imap_credential&.email_address
    when "outlook"
      @params.user&.outlook_credential&.email
    when "ms365"
      @params.mailbox_email.presence || find_ms365_credential&.email
    end
  end

  # Normalize attachments for IMAP (expects content as binary)
  def normalize_attachments_for_imap
    @params.attachments_list.map do |att|
      {
        filename: att[:filename] || att[:name],
        content: att[:content],
        content_type: att[:content_type]
      }
    end
  end

  # Normalize attachments for Graph API (expects Base64)
  def normalize_attachments_for_graph
    @params.attachments_list.map do |att|
      content = att[:content]
      # Convert to Base64 if not already
      content = Base64.strict_encode64(content) unless content.is_a?(String) && content.match?(/\A[A-Za-z0-9+\/=]+\z/)

      {
        name: att[:filename] || att[:name],
        content: content,
        content_type: att[:content_type]
      }
    end
  end
end
