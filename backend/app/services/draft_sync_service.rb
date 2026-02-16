# frozen_string_literal: true

# DraftSyncService - Provider-agnostic orchestrator for email draft sync
#
# Routes draft operations to the appropriate provider (MS365 or IMAP).
# The provider's Drafts folder is the SSoT - TEEEM DB is the working cache.
#
# Usage:
#   DraftSyncService.sync_to_provider(email_draft)   # Create/update draft on provider
#   DraftSyncService.send_draft(email_draft)          # Send via provider + delete draft
#   DraftSyncService.delete_from_provider(email_draft) # Delete from provider only
#
class DraftSyncService
  class SyncError < StandardError; end

  class << self
    def sync_to_provider(email_draft)
      new(email_draft).sync
    end

    def send_draft(email_draft)
      new(email_draft).send_via_provider
    end

    def delete_from_provider(email_draft)
      new(email_draft).delete_from_provider
    end
  end

  def initialize(email_draft)
    @draft = email_draft
  end

  # Create or update draft on the email provider
  def sync
    return unless @draft&.draft?

    if @draft.provider_draft_id.present?
      update_on_provider
    else
      create_on_provider
    end
  rescue => e
    Rails.logger.error "[DraftSyncService] Sync failed for draft #{@draft.id}: #{e.message}"
    @draft.update_columns(
      provider_sync_error: e.message.truncate(255),
      updated_at: Time.current
    )
  end

  # Send the draft via the provider, then clean up
  def send_via_provider
    case provider_type
    when "ms365"
      send_via_ms365
    when "imap"
      send_via_imap
    else
      raise SyncError, "Unknown provider type: #{provider_type}"
    end
  rescue => e
    Rails.logger.error "[DraftSyncService] Send failed for draft #{@draft.id}: #{e.message}"
    raise
  end

  # Delete draft from provider (called on discard)
  def delete_from_provider
    return unless @draft.provider_draft_id.present?

    case @draft.provider_type
    when "ms365"
      delete_from_ms365
    when "imap"
      delete_from_imap
    end
  rescue => e
    Rails.logger.warn "[DraftSyncService] Delete from provider failed for draft #{@draft.id}: #{e.message}"
    # Don't raise - provider delete failing shouldn't block TEEEM delete
  end

  private

  def provider_type
    @draft.provider_type || infer_provider_type
  end

  # Infer provider type from credential associations
  def infer_provider_type
    if @draft.microsoft_credential_id.present?
      "ms365"
    elsif @draft.imap_credential_id.present?
      "imap"
    else
      nil
    end
  end

  # ── MS365 Operations ──────────────────────────────────────────────────

  def create_on_ms365
    credential = find_ms365_credential
    client = Microsoft::EmailClient.new(credential)
    from_email = @draft.from_address.presence || credential.email

    result = client.create_draft(
      from: from_email,
      to: @draft.to_list,
      subject: @draft.subject || "",
      body: @draft.body || "",
      cc: @draft.cc_list,
      bcc: @draft.bcc_list,
      reply_to_message_id: @draft.reply_to_message_id
    )

    @draft.update_columns(
      provider_draft_id: result["id"],
      provider_type: "ms365",
      provider_synced_at: Time.current,
      provider_sync_error: nil
    )
  end

  def update_on_ms365
    credential = find_ms365_credential
    client = Microsoft::EmailClient.new(credential)
    from_email = @draft.from_address.presence || credential.email

    client.update_draft(
      from: from_email,
      draft_id: @draft.provider_draft_id,
      to: @draft.to_list,
      subject: @draft.subject || "",
      body: @draft.body || "",
      cc: @draft.cc_list,
      bcc: @draft.bcc_list
    )

    @draft.update_columns(
      provider_synced_at: Time.current,
      provider_sync_error: nil
    )
  rescue Microsoft::BaseClient::ApiError => e
    if e.message.include?("404")
      # Draft was deleted from Outlook - create a new one
      Rails.logger.info "[DraftSyncService] MS365 draft #{@draft.provider_draft_id} not found, creating new"
      @draft.update_columns(provider_draft_id: nil)
      create_on_ms365
    else
      raise
    end
  end

  def send_via_ms365
    credential = find_ms365_credential
    client = Microsoft::EmailClient.new(credential)
    from_email = @draft.from_address.presence || credential.email

    if @draft.provider_draft_id.present?
      # Send the existing draft (Graph API sends + removes from Drafts automatically)
      client.send_draft(from: from_email, draft_id: @draft.provider_draft_id)
    else
      # No provider draft - send directly via sendMail
      client.send_email(
        from: from_email,
        to: @draft.to_list,
        subject: @draft.subject || "",
        body: @draft.body || "",
        cc: @draft.cc_list,
        bcc: @draft.bcc_list,
        reply_to_message_id: @draft.reply_to_message_id
      )
    end

    # Log to warehouse
    log_sent_email(from_email)
  end

  def delete_from_ms365
    credential = find_ms365_credential
    client = Microsoft::EmailClient.new(credential)
    from_email = @draft.from_address.presence || credential.email

    client.delete_draft(from: from_email, draft_id: @draft.provider_draft_id)
  end

  # ── IMAP Operations ───────────────────────────────────────────────────

  def create_on_imap
    credential = find_imap_credential
    service = ImapEmailService.new(credential)

    uid = service.save_draft(
      to: @draft.to_list,
      subject: @draft.subject || "",
      body: @draft.body || "",
      cc: @draft.cc_list,
      bcc: @draft.bcc_list,
      from_address: @draft.from_address,
      reply_to_message_id: @draft.reply_to_message_id
    )

    @draft.update_columns(
      provider_draft_id: uid&.to_s,
      provider_type: "imap",
      provider_synced_at: Time.current,
      provider_sync_error: nil
    )
  end

  def update_on_imap
    credential = find_imap_credential
    service = ImapEmailService.new(credential)

    new_uid = service.update_draft(
      uid: @draft.provider_draft_id.to_i,
      to: @draft.to_list,
      subject: @draft.subject || "",
      body: @draft.body || "",
      cc: @draft.cc_list,
      bcc: @draft.bcc_list,
      from_address: @draft.from_address,
      reply_to_message_id: @draft.reply_to_message_id
    )

    @draft.update_columns(
      provider_draft_id: new_uid&.to_s,
      provider_synced_at: Time.current,
      provider_sync_error: nil
    )
  end

  def send_via_imap
    credential = find_imap_credential
    service = ImapEmailService.new(credential)

    attachments = resolve_attachments

    if @draft.provider_draft_id.present?
      # Send via SMTP and delete draft from IMAP Drafts
      service.send_and_delete_draft(
        uid: @draft.provider_draft_id.to_i,
        to: @draft.to_list,
        subject: @draft.subject || "",
        body: @draft.body || "",
        cc: @draft.cc_list,
        bcc: @draft.bcc_list,
        attachments: attachments,
        reply_to_message_id: @draft.reply_to_message_id,
        from_address: @draft.from_address
      )
    else
      # No provider draft - just send via SMTP
      service.send_email(
        to: @draft.to_list,
        subject: @draft.subject || "",
        body: @draft.body || "",
        cc: @draft.cc_list,
        bcc: @draft.bcc_list,
        attachments: attachments,
        reply_to_message_id: @draft.reply_to_message_id,
        from_address: @draft.from_address
      )
    end
  end

  def delete_from_imap
    credential = find_imap_credential
    service = ImapEmailService.new(credential)
    service.delete_draft(uid: @draft.provider_draft_id.to_i)
  end

  # ── Provider routing ──────────────────────────────────────────────────

  def create_on_provider
    case provider_type
    when "ms365"
      create_on_ms365
    when "imap"
      create_on_imap
    else
      Rails.logger.debug "[DraftSyncService] No provider type for draft #{@draft.id}, skipping sync"
    end
  end

  def update_on_provider
    case @draft.provider_type
    when "ms365"
      update_on_ms365
    when "imap"
      update_on_imap
    else
      Rails.logger.debug "[DraftSyncService] No provider type for draft #{@draft.id}, skipping update"
    end
  end

  # ── Credential lookups ────────────────────────────────────────────────

  def find_ms365_credential
    credential = MicrosoftCredential.find_by(id: @draft.microsoft_credential_id)
    raise SyncError, "MS365 credential not found (id: #{@draft.microsoft_credential_id})" unless credential
    credential
  end

  def find_imap_credential
    credential = ImapCredential.find_by(id: @draft.imap_credential_id)
    raise SyncError, "IMAP credential not found (id: #{@draft.imap_credential_id})" unless credential
    credential
  end

  # Resolve draft attachments from storage (if any exist)
  # Draft attachments are stored as name references - actual content is fetched at send time
  def resolve_attachments
    return [] unless @draft.attachments.present?

    # Draft attachments are metadata-only (names/sizes) until send time
    # Actual file content must be provided by the controller at send time
    []
  end

  # Log sent email to SyncedEmail warehouse
  def log_sent_email(from_email)
    user = @draft.user
    return unless user

    SyncedEmail.create!(
      internet_message_id: SecureRandom.uuid,
      source_type: @draft.provider_type,
      imap_credential_id: @draft.imap_credential_id,
      microsoft_credential_id: @draft.microsoft_credential_id,
      mailbox_owner_email: from_email,
      subject: @draft.subject,
      body_html: @draft.body,
      body_text: ActionController::Base.helpers.strip_tags(@draft.body || ""),
      from_email: from_email,
      from_name: user.name,
      to_emails: @draft.to_list,
      cc_emails: @draft.cc_list,
      received_at: Time.current,
      sent_at: Time.current,
      folder_name: "Sent Items",
      first_synced_at: Time.current,
      last_synced_at: Time.current,
      synced_by_user: user,
      tenant_id: user.tenant_id
    )
  rescue => e
    Rails.logger.warn "[DraftSyncService] Failed to log sent email: #{e.message}"
  end
end
