# frozen_string_literal: true

# RfqSendingService - Orchestrates sending RFQ (Request for Quote) emails
#
# Uses EmailSendingService (SSoT) for actual delivery.
# Applies EmailTemplate variable substitution for personalized emails.
# Optionally attaches WarehouseDocuments (plans, engineering, etc.).
#
# Usage:
#   # Send single RFQ
#   result = RfqSendingService.send_rfq(
#     tracker: quote_tracker,
#     user: current_user,
#     email_template_id: 123,        # Optional - uses default if nil
#     document_ids: [1, 2, 3],       # Optional - WarehouseDocument IDs to attach
#     custom_message: "Please quote", # Optional - appended to template body
#     account_type: "imap",           # "imap" or "ms365"
#     credential_id: 456,
#     mailbox_email: nil              # Required for ms365
#   )
#
#   # Send bulk RFQs for a trade
#   results = RfqSendingService.send_bulk(
#     trackers: QuoteTracker.where(job_id: 1, sm_trade_id: 2, status: 'draft'),
#     user: current_user,
#     email_template_id: 123,
#     document_ids: [1, 2],
#     account_type: "imap",
#     credential_id: 456
#   )
#
class RfqSendingService
  class SendError < StandardError; end

  # Result for a single send
  Result = Struct.new(:success, :tracker_id, :message_id, :error, keyword_init: true) do
    def success?
      success == true
    end
  end

  # Result for bulk send
  BulkResult = Struct.new(:total, :sent, :failed, :results, keyword_init: true) do
    def all_success?
      failed.zero?
    end
  end

  class << self
    # Send a single RFQ email
    def send_rfq(tracker:, user:, email_template_id: nil, document_ids: [], custom_message: nil, account_type:, credential_id:, mailbox_email: nil)
      new(
        user: user,
        email_template_id: email_template_id,
        document_ids: document_ids,
        custom_message: custom_message,
        account_type: account_type,
        credential_id: credential_id,
        mailbox_email: mailbox_email
      ).send_single(tracker)
    end

    # Send RFQs to multiple suppliers (e.g., all for a trade)
    # Groups trackers by supplier_id so the same supplier receives ONE consolidated
    # email listing all tasks, rather than separate emails per task.
    def send_bulk(trackers:, user:, email_template_id: nil, document_ids: [], custom_message: nil, account_type:, credential_id:, mailbox_email: nil)
      service = new(
        user: user,
        email_template_id: email_template_id,
        document_ids: document_ids,
        custom_message: custom_message,
        account_type: account_type,
        credential_id: credential_id,
        mailbox_email: mailbox_email
      )

      results = []
      grouped = trackers.group_by(&:supplier_id)

      grouped.each do |_supplier_id, supplier_trackers|
        if supplier_trackers.size == 1
          results << service.send_single(supplier_trackers.first)
        else
          results.concat(service.send_consolidated(supplier_trackers))
        end
      end

      sent = results.count(&:success?)

      BulkResult.new(
        total: results.size,
        sent: sent,
        failed: results.size - sent,
        results: results
      )
    end
  end

  def initialize(user:, email_template_id: nil, document_ids: [], custom_message: nil, account_type:, credential_id:, mailbox_email: nil)
    @user = user
    @email_template_id = email_template_id
    @document_ids = Array(document_ids).compact
    @custom_message = custom_message
    @account_type = account_type
    @credential_id = credential_id
    @mailbox_email = mailbox_email
  end

  # Send RFQ for a single tracker
  def send_single(tracker)
    validate_tracker!(tracker)

    # Build email content
    recipient_email = resolve_recipient_email(tracker)
    raise SendError, "No email address for supplier #{tracker.supplier&.display_name}" unless recipient_email.present?

    subject, body = compose_email(tracker)
    attachments = build_attachments(tracker)

    # Send via EmailSendingService (SSoT)
    email_result = EmailSendingService.send_and_log(
      account_type: @account_type,
      credential_id: @credential_id,
      user: @user,
      to: [recipient_email],
      subject: subject,
      body: body,
      attachments: attachments,
      mailbox_email: @mailbox_email
    )

    if email_result.success?
      # Update tracker: mark as sent + store message_id for thread tracking
      tracker.update!(
        status: 'sent',
        sent_at: Time.current,
        sent_by: @user,
        email_message_id: email_result.message_id
      )

      Result.new(success: true, tracker_id: tracker.id, message_id: email_result.message_id)
    else
      Rails.logger.error("[RfqSendingService] Failed to send RFQ for tracker #{tracker.id}: #{email_result.error}")
      Result.new(success: false, tracker_id: tracker.id, error: email_result.error)
    end
  rescue SendError => e
    Result.new(success: false, tracker_id: tracker.id, error: e.message)
  rescue StandardError => e
    Rails.logger.error("[RfqSendingService] Unexpected error for tracker #{tracker.id}: #{e.class} - #{e.message}")
    Result.new(success: false, tracker_id: tracker.id, error: e.message)
  end

  # Send ONE consolidated email for multiple trackers to the SAME supplier.
  # All trackers must be draft status and share the same supplier_id.
  # On success: marks ALL trackers as sent with the same email_message_id.
  # On failure: marks NONE (atomic — don't partially send).
  # Returns an array of Result structs (one per tracker).
  def send_consolidated(supplier_trackers)
    # Validate all are draft + same supplier
    supplier_trackers.each { |t| validate_tracker!(t) }
    supplier_ids = supplier_trackers.map(&:supplier_id).uniq
    raise SendError, "Consolidated send requires all trackers to have the same supplier" if supplier_ids.size != 1

    first_tracker = supplier_trackers.first
    recipient_email = resolve_recipient_email(first_tracker)
    raise SendError, "No email address for supplier #{first_tracker.supplier&.display_name}" unless recipient_email.present?

    subject, body = compose_consolidated_email(supplier_trackers)
    attachments = build_attachments(first_tracker) # Same document_ids, download once

    # Send ONE email via EmailSendingService (SSoT)
    email_result = EmailSendingService.send_and_log(
      account_type: @account_type,
      credential_id: @credential_id,
      user: @user,
      to: [recipient_email],
      subject: subject,
      body: body,
      attachments: attachments,
      mailbox_email: @mailbox_email
    )

    if email_result.success?
      # Mark ALL trackers as sent with the same message_id
      supplier_trackers.each do |tracker|
        tracker.update!(
          status: 'sent',
          sent_at: Time.current,
          sent_by: @user,
          email_message_id: email_result.message_id
        )
      end

      supplier_trackers.map do |tracker|
        Result.new(success: true, tracker_id: tracker.id, message_id: email_result.message_id)
      end
    else
      Rails.logger.error("[RfqSendingService] Failed consolidated send for supplier #{first_tracker.supplier_id}: #{email_result.error}")
      supplier_trackers.map do |tracker|
        Result.new(success: false, tracker_id: tracker.id, error: email_result.error)
      end
    end
  rescue SendError => e
    supplier_trackers.map { |t| Result.new(success: false, tracker_id: t.id, error: e.message) }
  rescue StandardError => e
    Rails.logger.error("[RfqSendingService] Unexpected error in consolidated send: #{e.class} - #{e.message}")
    supplier_trackers.map { |t| Result.new(success: false, tracker_id: t.id, error: e.message) }
  end

  private

  def validate_tracker!(tracker)
    raise SendError, "Tracker is already sent or processed (status: #{tracker.status})" unless tracker.status == 'draft'
    raise SendError, "Tracker has no supplier" unless tracker.supplier.present?
  end

  # Resolve the best email address for the supplier
  def resolve_recipient_email(tracker)
    # Priority: contact person email > tracker.contact_email > supplier primary email
    tracker.contact&.email.presence ||
      tracker.contact_email.presence ||
      tracker.supplier&.email.presence
  end

  # Compose consolidated email for multiple trackers to the same supplier
  def compose_consolidated_email(supplier_trackers)
    first_tracker = supplier_trackers.first
    job = first_tracker.job
    template = find_template

    task_names = supplier_trackers.map(&:task_name).compact.join(", ")

    if template
      # Apply template using first tracker context, but replace task_name with combined list
      context = build_template_context(first_tracker, job)
      context[:trade_name] = task_names
      context[:task_name] = task_names
      rendered = template.apply(context)
      template.record_usage!

      subject = rendered[:subject]
      body = rendered[:body_html]
    else
      subject = "Request for Quote - #{job.name} (#{job.job_code})"
      body = build_consolidated_default_body(supplier_trackers, job)
    end

    if @custom_message.present?
      body += "<br><br><p>#{ERB::Util.html_escape(@custom_message)}</p>"
    end

    [subject, body]
  end

  # Compose email subject and body
  def compose_email(tracker)
    job = tracker.job
    template = find_template

    if template
      context = build_template_context(tracker, job)
      rendered = template.apply(context)
      template.record_usage!

      subject = rendered[:subject]
      body = rendered[:body_html]
    else
      # Default email when no template selected
      subject = "Request for Quote - #{job.name} (#{job.job_code})"
      body = build_default_body(tracker, job)
    end

    # Append custom message if provided
    if @custom_message.present?
      body += "<br><br><p>#{ERB::Util.html_escape(@custom_message)}</p>"
    end

    [subject, body]
  end

  # Find the email template (by ID or default RFQ template)
  def find_template
    if @email_template_id.present?
      EmailTemplate.available_to(@user).find_by(id: @email_template_id)
    else
      # Look for a default RFQ template (category: "quote")
      EmailTemplate.available_to(@user).where(category: 'quote').ordered.first
    end
  end

  # Build template variable context
  def build_template_context(tracker, job)
    {
      job_name: job.name,
      job_number: job.job_code,
      job_address: job.address,
      trade_name: tracker.task_name,
      task_name: tracker.task_name,
      supplier_name: tracker.supplier&.display_name,
      recipient_name: tracker.contact&.name || tracker.supplier&.display_name,
      recipient_email: resolve_recipient_email(tracker),
      recipient_company: tracker.supplier&.display_name,
      sender_name: @user.name,
      sender_email: @user.email,
      sender_phone: @user.phone,
      today_date: Date.current.strftime("%d %B %Y"),
      company_name: @user.tenant&.name,
      instructions: tracker.quote_request_instructions
    }
  end

  # Default email body when no template is selected
  def build_default_body(tracker, job)
    parts = []
    parts << "<p>Hi #{ERB::Util.html_escape(tracker.contact&.first_name || tracker.supplier&.display_name || 'there')},</p>"
    parts << "<p>We would like to request a quote for the following:</p>"
    parts << "<ul>"
    parts << "<li><strong>Project:</strong> #{ERB::Util.html_escape(job.name)}</li>"
    parts << "<li><strong>Reference:</strong> #{ERB::Util.html_escape(job.job_code)}</li>" if job.job_code.present?
    parts << "<li><strong>Address:</strong> #{ERB::Util.html_escape(job.address)}</li>" if job.address.present?
    parts << "<li><strong>Trade:</strong> #{ERB::Util.html_escape(tracker.task_name)}</li>" if tracker.task_name.present?
    parts << "</ul>"

    if tracker.quote_request_instructions.present?
      parts << "<p><strong>Instructions:</strong></p>"
      parts << "<p>#{ERB::Util.html_escape(tracker.quote_request_instructions)}</p>"
    end

    parts << "<p>Please provide your best quote at your earliest convenience.</p>"
    parts << "<p>Kind regards,<br>#{ERB::Util.html_escape(@user.name)}</p>"
    parts.join("\n")
  end

  # Default email body for consolidated send (multiple tasks, one supplier)
  def build_consolidated_default_body(supplier_trackers, job)
    first_tracker = supplier_trackers.first
    parts = []
    parts << "<p>Hi #{ERB::Util.html_escape(first_tracker.contact&.first_name || first_tracker.supplier&.display_name || 'there')},</p>"
    parts << "<p>We would like to request quotes for the following items on #{ERB::Util.html_escape(job.name)} (#{ERB::Util.html_escape(job.job_code)}):</p>"

    # Task table
    parts << '<table style="border-collapse: collapse; width: 100%; margin: 12px 0;">'
    parts << '<tr style="background-color: #f3f4f6;">'
    parts << '<th style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">Task</th>'
    parts << '<th style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">Instructions</th>'
    parts << '</tr>'

    supplier_trackers.each do |tracker|
      task = ERB::Util.html_escape(tracker.task_name || "—")
      instructions = tracker.quote_request_instructions.present? ? ERB::Util.html_escape(tracker.quote_request_instructions) : "—"
      parts << "<tr>"
      parts << "<td style=\"border: 1px solid #d1d5db; padding: 8px;\">#{task}</td>"
      parts << "<td style=\"border: 1px solid #d1d5db; padding: 8px;\">#{instructions}</td>"
      parts << "</tr>"
    end

    parts << '</table>'

    if job.address.present?
      parts << "<p><strong>Site Address:</strong> #{ERB::Util.html_escape(job.address)}</p>"
    end

    parts << "<p>Please provide your best quote at your earliest convenience.</p>"
    parts << "<p>Kind regards,<br>#{ERB::Util.html_escape(@user.name)}</p>"
    parts.join("\n")
  end

  # Build email attachments from WarehouseDocument IDs
  def build_attachments(tracker)
    return [] if @document_ids.empty?

    attachments = []
    job = tracker.job

    # Load WarehouseDocuments scoped to this job
    documents = WarehouseDocument.where(id: @document_ids)
    documents.each do |doc|
      next unless doc.storage_blob.present?

      begin
        content = download_document(doc)
        next unless content

        attachments << {
          filename: doc.download_filename.presence || doc.ui_name || "document",
          content: content,
          content_type: doc.storage_blob.content_type || "application/octet-stream"
        }
      rescue StandardError => e
        Rails.logger.warn("[RfqSendingService] Failed to attach document #{doc.id}: #{e.message}")
      end
    end

    attachments
  end

  # Download document content from storage
  def download_document(doc)
    blob = doc.storage_blob
    return nil unless blob&.storage_path.present?

    provider = WarehouseProvider.instance
    case provider.provider_type
    when 's3_compatible'
      credential = S3CompatibleCredential.active.first
      return nil unless credential

      client = Aws::S3::Client.new(
        access_key_id: credential.access_key_id,
        secret_access_key: credential.secret_access_key,
        region: credential.region || 'us-east-1',
        endpoint: credential.endpoint_url
      )

      resp = client.get_object(
        bucket: credential.bucket_name,
        key: blob.storage_path
      )
      resp.body.read
    else
      Rails.logger.warn("[RfqSendingService] Unsupported provider type for attachments: #{provider.provider_type}")
      nil
    end
  rescue StandardError => e
    Rails.logger.error("[RfqSendingService] Download failed for blob #{blob&.id}: #{e.message}")
    nil
  end
end
