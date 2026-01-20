# frozen_string_literal: true

# Monitors a shared mailbox for incoming supplier invoices
# Creates BillInbox records for each PDF attachment and queues AI extraction
#
# SSoT: Mailbox address configured in CorporateCompanySetting.monitored_mailbox_pay
class BillInboxSyncService
  SUPPORTED_CONTENT_TYPES = [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/jpg"
  ].freeze

  def initialize(since: nil, mailbox: nil)
    @since = since || 1.hour.ago
    # SSoT: Get monitored mailbox from CorporateCompanySetting
    @mailbox = mailbox || CorporateCompanySetting.monitored_mailbox_pay
    @client = MicrosoftAppGraphClient.new
  end

  def sync!
    Rails.logger.info "[BillInboxSync] Starting sync for #{@mailbox} since #{@since}"

    emails = fetch_emails
    results = { processed: 0, created: 0, skipped: 0, errors: 0 }

    emails.each do |email|
      process_email(email, results)
    end

    Rails.logger.info "[BillInboxSync] Complete: #{results}"
    results
  end

  # Wrapper method without bang for CLI compatibility
  def self.reattach_file(bill_id)
    reattach_file!(bill_id)
  end

  # Re-attach the invoice file from the original email for a bill that lost its file
  def self.reattach_file!(bill_id)
    bill = BillInbox.find(bill_id)

    unless bill.email_message_id.present?
      raise "Bill ##{bill_id} has no email_message_id - cannot re-fetch"
    end

    client = MicrosoftAppGraphClient.new
    mailbox = MONITORED_MAILBOX

    # Find the email by internet_message_id
    emails = client.get_user_emails(mailbox, folder: "inbox", top: 500, since: 30.days.ago)
    email = emails.find { |e| e["internetMessageId"] == bill.email_message_id }

    unless email
      raise "Could not find email with message_id: #{bill.email_message_id}"
    end

    # Get attachments
    attachments = client.get_email_attachments(mailbox, email["id"])
    invoice_attachment = attachments.find { |a| a["name"] == bill.original_filename }

    unless invoice_attachment
      # Try first PDF/image attachment
      invoice_attachment = attachments.find { |a| SUPPORTED_CONTENT_TYPES.include?(a["contentType"]&.downcase) }
    end

    unless invoice_attachment
      raise "No suitable attachment found in email"
    end

    # Download content
    content = if invoice_attachment["contentBytes"]
      Base64.decode64(invoice_attachment["contentBytes"])
    else
      client.get_attachment_content(mailbox, email["id"], invoice_attachment["id"])
    end

    # Re-attach file
    bill.invoice_file.purge if bill.invoice_file.attached?
    bill.invoice_file.attach(
      io: StringIO.new(content),
      filename: invoice_attachment["name"],
      content_type: invoice_attachment["contentType"]
    )

    Rails.logger.info "[BillInboxSync] Re-attached file to BillInbox ##{bill.id}"
    bill
  end

  private

  def fetch_emails
    @client.get_user_emails(
      @mailbox,
      folder: "inbox",
      since: @since,
      top: 100
    )
  rescue StandardError => e
    Rails.logger.error "[BillInboxSync] Failed to fetch emails: #{e.message}"
    []
  end

  def process_email(email, results)
    results[:processed] += 1

    # Skip if already processed (by internet_message_id)
    internet_message_id = email["internetMessageId"]
    if BillInbox.exists?(email_message_id: internet_message_id)
      results[:skipped] += 1
      Rails.logger.debug "[BillInboxSync] Skipping already processed: #{internet_message_id}"
      return
    end

    # Only process emails with attachments
    unless email["hasAttachments"]
      results[:skipped] += 1
      return
    end

    # Fetch attachments
    attachments = @client.get_email_attachments(@mailbox, email["id"])
    invoice_attachments = attachments.select { |a| supported_attachment?(a) }

    if invoice_attachments.empty?
      results[:skipped] += 1
      return
    end

    # Prioritize PDFs over images (images are often just email signatures)
    pdf_attachments = invoice_attachments.select { |a| a["contentType"]&.downcase == "application/pdf" }
    if pdf_attachments.any?
      invoice_attachments = pdf_attachments
    else
      # If no PDFs, filter out small images (< 50KB) which are likely signatures
      invoice_attachments = invoice_attachments.reject do |a|
        is_image = a["contentType"]&.downcase&.start_with?("image/")
        is_small = (a["size"] || 0) < 50_000
        is_image && is_small
      end
    end

    if invoice_attachments.empty?
      results[:skipped] += 1
      Rails.logger.debug "[BillInboxSync] No valid invoice attachments after filtering"
      return
    end

    # Store email in warehouse first
    warehouse_email = store_email_in_warehouse(email)

    # Create BillInbox for each invoice attachment
    invoice_attachments.each do |attachment|
      bill = create_bill_from_attachment(email, attachment, warehouse_email)
      if bill
        results[:created] += 1
        # Queue AI extraction job
        InvoiceExtractionJob.perform_later(bill.id)
      end
    end
  rescue StandardError => e
    Rails.logger.error "[BillInboxSync] Error processing email #{email["id"]}: #{e.message}"
    Rails.logger.error e.backtrace.first(5).join("\n")
    results[:errors] += 1
  end

  def supported_attachment?(attachment)
    content_type = attachment["contentType"]&.downcase
    SUPPORTED_CONTENT_TYPES.include?(content_type)
  end

  def store_email_in_warehouse(email)
    SyncedEmail.find_or_create_by(internet_message_id: email["internetMessageId"]) do |e|
      e.outlook_id = email["id"]
      e.subject = email["subject"]
      e.from_email = email.dig("from", "emailAddress", "address")
      e.from_name = email.dig("from", "emailAddress", "name")
      e.received_at = email["receivedDateTime"]
      e.has_attachments = true
      # Store the monitored mailbox info in folder_name as a workaround
      e.folder_name = "bill_inbox:#{@mailbox}"
    end
  end

  def create_bill_from_attachment(email, attachment, warehouse_email)
    # Determine sender domain for rule application
    from_email = email.dig("from", "emailAddress", "address")
    sender_domain = from_email&.split("@")&.last&.downcase

    # Create bill inbox entry
    bill = BillInbox.create!(
      source: "email",
      email_message_id: email["internetMessageId"],
      synced_email_id: warehouse_email.id,
      status: "pending",
      original_filename: attachment["name"],
      content_type: attachment["contentType"],
      notes: "From: #{from_email}\nSubject: #{email["subject"]}"
    )

    # Download and attach the file
    content = if attachment["contentBytes"]
      Base64.decode64(attachment["contentBytes"])
    else
      # Large attachment - need to fetch content separately
      @client.get_attachment_content(@mailbox, email["id"], attachment["id"])
    end

    bill.invoice_file.attach(
      io: StringIO.new(content),
      filename: attachment["name"],
      content_type: attachment["contentType"]
    )

    Rails.logger.info "[BillInboxSync] Created BillInbox ##{bill.id} from #{from_email}"
    bill
  rescue ActiveRecord::RecordInvalid => e
    Rails.logger.error "[BillInboxSync] Failed to create bill: #{e.message}"
    nil
  end
end
