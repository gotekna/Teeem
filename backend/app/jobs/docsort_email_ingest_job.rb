# frozen_string_literal: true

# DocsortEmailIngestJob - Sync emails from docsort@tekna.com.au shared mailbox
#
# Creates DocsortItem records for:
# - Each email (for classification/routing of email content)
# - Each attachment (for classification/routing of attached files)
#
# Usage:
#   DocsortEmailIngestJob.perform_now                    # Incremental sync
#   DocsortEmailIngestJob.perform_now('full')            # Full sync
#   DocsortEmailIngestJob.perform_later                  # Background incremental
#
class DocsortEmailIngestJob < ApplicationJob
  queue_as :default

  # Retry on transient errors
  retry_on Net::OpenTimeout, Net::ReadTimeout, SocketError, Errno::ECONNREFUSED, Faraday::TimeoutError,
           wait: :polynomially_longer, attempts: 3

  # Discard if record not found
  discard_on ActiveRecord::RecordNotFound

  # Configuration
  DOCSORT_MAILBOX = 'docsort@tekna.com.au'.freeze
  SYNC_LOOKBACK_DAYS = 7 # For incremental, look back 7 days
  SYNC_FULL_DAYS = 90    # For full sync, look back 90 days

  def perform(sync_type = 'incremental', organization_id: nil)
    @credential = find_credential(organization_id)

    unless @credential&.status == 'connected'
      Rails.logger.info "[DocsortEmailIngest] Skipping - Microsoft app not connected"
      return { success: false, error: 'Microsoft app not connected' }
    end

    # Determine sync window
    since = case sync_type
            when 'full'
              SYNC_FULL_DAYS.days.ago
            else
              [@credential.last_sync_at&.-(2.hours) || SYNC_LOOKBACK_DAYS.days.ago,
               SYNC_LOOKBACK_DAYS.days.ago].min
            end

    Rails.logger.info "[DocsortEmailIngest] Starting #{sync_type} sync for #{DOCSORT_MAILBOX} since #{since}"

    total_items = 0
    errors = []

    begin
      client = MicrosoftAppGraphClient.new(@credential)

      # Get all folders for the docsort mailbox
      folders = client.get_user_mail_folders(DOCSORT_MAILBOX)
      inbox_folder = folders.find { |f| f[:name] == 'Inbox' }

      unless inbox_folder
        Rails.logger.warn "[DocsortEmailIngest] No Inbox folder found for #{DOCSORT_MAILBOX}"
        return { success: false, error: 'No Inbox folder found' }
      end

      # Sync only the Inbox folder (ignore Sent, Junk, etc.)
      items_created = sync_folder(client, inbox_folder, since)
      total_items += items_created

      Rails.logger.info "[DocsortEmailIngest] Completed: #{total_items} items created"
    rescue StandardError => e
      Rails.logger.error "[DocsortEmailIngest] Error: #{e.message}"
      errors << e.message
    end

    { success: errors.empty?, total_items: total_items, errors: errors }
  end

  private

  def sync_folder(client, folder, since)
    items_created = 0
    page = 0
    skip = 0
    max_pages = 100

    loop do
      emails = client.get_user_emails(
        DOCSORT_MAILBOX,
        folder: folder[:id],
        top: 50,
        since: since,
        skip: skip
      )

      break if emails.empty?

      emails.each do |email_data|
        created = process_email(email_data, client)
        items_created += created
      end

      page += 1
      skip += 50
      break if page >= max_pages || emails.count < 50
    end

    Rails.logger.info "[DocsortEmailIngest] Synced #{items_created} items from #{folder[:name]}"
    items_created
  end

  def process_email(email_data, client)
    items_created = 0
    internet_message_id = email_data['internetMessageId'] || email_data['id']

    # Skip if we've already processed this email
    existing = DocsortItem.find_by(
      source: 'email',
      'metadata->internet_message_id': internet_message_id
    )
    return 0 if existing

    # Set tenant context
    tenant = @credential.organization&.tenant || Tenant.first
    return 0 unless tenant

    ActsAsTenant.with_tenant(tenant) do
      # Extract email data
      from_data = email_data['from']&.dig('emailAddress') || {}
      from_email = from_data['address']
      from_name = from_data['name']
      subject = email_data['subject'] || '(No Subject)'
      has_attachments = email_data['hasAttachments'] || false
      received_at = email_data['receivedDateTime']

      # Create or find SyncedEmail record (for linking)
      synced_email = find_or_create_synced_email(email_data, tenant)

      # If email has attachments, process each one as a separate DocsortItem
      if has_attachments
        attachments = fetch_attachments(client, email_data['id'])

        attachments.each do |attachment|
          next unless attachment['@odata.type'] == '#microsoft.graph.fileAttachment'
          next if skip_attachment?(attachment)

          item = create_docsort_item_from_attachment(
            attachment: attachment,
            email_data: email_data,
            synced_email: synced_email,
            tenant: tenant,
            from_email: from_email,
            subject: subject
          )

          if item
            items_created += 1
            # Queue classification
            DocsortClassificationJob.perform_later(item.id)
          end
        end
      end

      # Also create a DocsortItem for the email itself (for email classification)
      # This is useful for correspondence routing
      if !has_attachments || attachments_are_all_signatures?(fetch_attachments(client, email_data['id']))
        item = create_docsort_item_from_email(
          email_data: email_data,
          synced_email: synced_email,
          tenant: tenant,
          from_email: from_email,
          subject: subject
        )

        if item
          items_created += 1
          DocsortClassificationJob.perform_later(item.id)
        end
      end
    end

    items_created
  rescue StandardError => e
    Rails.logger.error "[DocsortEmailIngest] Error processing email: #{e.message}"
    0
  end

  def find_or_create_synced_email(email_data, tenant)
    internet_message_id = email_data['internetMessageId'] || email_data['id']

    email = SyncedEmail.find_or_initialize_by(internet_message_id: internet_message_id)

    if email.new_record?
      from_data = email_data['from']&.dig('emailAddress') || {}
      to_emails = (email_data['toRecipients'] || []).map { |r| r.dig('emailAddress', 'address') }.compact
      cc_emails = (email_data['ccRecipients'] || []).map { |r| r.dig('emailAddress', 'address') }.compact

      body_data = email_data['body'] || {}
      body_content = body_data['content']
      body_type = body_data['contentType']&.downcase

      email.assign_attributes(
        tenant_id: tenant.id,
        subject: email_data['subject'],
        from_email: from_data['address'],
        from_name: from_data['name'],
        to_emails: to_emails,
        cc_emails: cc_emails,
        received_at: email_data['receivedDateTime'],
        sent_at: email_data['sentDateTime'],
        has_attachments: email_data['hasAttachments'] || false,
        body_preview: email_data['bodyPreview'],
        body_text: body_type == 'html' ? extract_text_from_html(body_content) : body_content,
        body_html: body_type == 'html' ? body_content : nil,
        conversation_id: email_data['conversationId'],
        importance: email_data['importance'],
        outlook_id: email_data['id'],
        mailbox_owner_email: DOCSORT_MAILBOX,
        folder_name: 'Inbox',
        microsoft_credential_id: @credential.id,
        first_synced_at: Time.current,
        last_synced_at: Time.current
      )

      email.save!
    end

    email
  end

  def create_docsort_item_from_attachment(attachment:, email_data:, synced_email:, tenant:, from_email:, subject:)
    filename = attachment['name']
    content_type = attachment['contentType']
    content_bytes = attachment['contentBytes']

    return nil unless content_bytes.present?

    # Decode base64 content
    file_content = Base64.decode64(content_bytes)
    file_size = file_content.bytesize

    # Create StorageBlob for the attachment
    storage_blob = StorageBlob.find_or_create_for_content!(
      file_content,
      filename: filename,
      content_type: content_type
    )

    DocsortItem.create!(
      tenant: tenant,
      source: 'email',
      status: 'pending',
      synced_email: synced_email,
      storage_blob: storage_blob,
      original_filename: filename,
      content_type: content_type,
      file_size: file_size,
      from_email: from_email,
      subject: subject,
      metadata: {
        internet_message_id: email_data['internetMessageId'] || email_data['id'],
        outlook_id: email_data['id'],
        attachment_id: attachment['id'],
        received_at: email_data['receivedDateTime'],
        attachment_name: filename
      }
    )
  rescue StandardError => e
    Rails.logger.error "[DocsortEmailIngest] Error creating item from attachment: #{e.message}"
    nil
  end

  def create_docsort_item_from_email(email_data:, synced_email:, tenant:, from_email:, subject:)
    DocsortItem.create!(
      tenant: tenant,
      source: 'email',
      status: 'pending',
      synced_email: synced_email,
      original_filename: "#{subject.truncate(50)}.eml",
      content_type: 'message/rfc822',
      from_email: from_email,
      subject: subject,
      document_type: 'email', # Pre-classify as email
      classification_confidence: 1.0, # High confidence since it IS an email
      metadata: {
        internet_message_id: email_data['internetMessageId'] || email_data['id'],
        outlook_id: email_data['id'],
        received_at: email_data['receivedDateTime'],
        body_preview: email_data['bodyPreview']
      }
    )
  rescue StandardError => e
    Rails.logger.error "[DocsortEmailIngest] Error creating item from email: #{e.message}"
    nil
  end

  def fetch_attachments(client, message_id)
    client.get_email_attachments(DOCSORT_MAILBOX, message_id)
  rescue StandardError => e
    Rails.logger.error "[DocsortEmailIngest] Error fetching attachments: #{e.message}"
    []
  end

  def skip_attachment?(attachment)
    filename = attachment['name']&.downcase || ''

    # Skip image signatures (inline images in email body)
    return true if attachment['isInline'] == true

    # Skip common signature images
    signature_patterns = [
      /^image\d*\.(png|jpg|jpeg|gif)$/i,
      /^logo\.(png|jpg|jpeg|gif)$/i,
      /^signature\.(png|jpg|jpeg|gif)$/i,
      /^banner\.(png|jpg|jpeg|gif)$/i
    ]

    signature_patterns.any? { |pattern| filename.match?(pattern) }
  end

  def attachments_are_all_signatures?(attachments)
    return true if attachments.empty?

    attachments.all? do |att|
      att['@odata.type'] != '#microsoft.graph.fileAttachment' || skip_attachment?(att)
    end
  end

  def find_credential(organization_id)
    if organization_id.present?
      org = Organization.find_by(id: organization_id)
      return MicrosoftCredential.active_for_org(org) if org
    end

    # Fallback to first active app credential
    MicrosoftCredential.app_credentials.active.first
  end

  def extract_text_from_html(html_content)
    return nil if html_content.blank?

    text = html_content.gsub(/<[^>]*>/, '')
    CGI.unescapeHTML(text).strip
  end
end
