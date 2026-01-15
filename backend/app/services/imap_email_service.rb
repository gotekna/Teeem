require "net/imap"
require "mail"

class ImapEmailService
  attr_reader :credential

  def initialize(credential)
    @credential = credential
  end

  # Fetch emails from IMAP server
  # @param since [Time] Only fetch emails received after this time
  # @param folder [String] IMAP folder to fetch from (default: INBOX)
  # @param limit [Integer] Maximum number of emails to fetch
  # @return [Array<Hash>] Array of email data hashes
  def fetch_emails(since: nil, folder: "INBOX", limit: 100)
    emails = []

    with_imap_connection do |imap|
      imap.select(folder)

      # Build search criteria
      search_criteria = build_search_criteria(since: since)

      # Search for matching emails
      message_ids = imap.search(search_criteria)

      # Limit results
      message_ids = message_ids.last(limit) if limit && message_ids.size > limit

      return emails if message_ids.empty?

      # Fetch email data in batches
      # Use BODY.PEEK[] instead of RFC822 to avoid marking emails as read
      message_ids.each_slice(50) do |batch|
        fetch_data = imap.fetch(batch, [
          "UID",
          "BODY.PEEK[]",
          "ENVELOPE",
          "FLAGS",
          "INTERNALDATE"
        ])

        fetch_data&.each do |msg|
          email_data = parse_email_message(msg, folder)
          emails << email_data if email_data
        end
      end
    end

    emails
  rescue => e
    Rails.logger.error "[ImapEmailService] Error fetching emails: #{e.message}"
    raise
  end

  # Fetch emails incrementally using UID
  # @return [Array<Hash>] Array of email data hashes
  def fetch_new_emails(folder: "INBOX", limit: 500)
    emails = []

    with_imap_connection do |imap|
      imap.select(folder)

      # Get emails with UID greater than last synced
      last_uid = credential.last_uid || 0
      search_criteria = ["UID", "#{last_uid + 1}:*"]

      message_ids = imap.uid_search(search_criteria)
      return emails if message_ids.empty?

      # Limit results
      message_ids = message_ids.first(limit) if limit && message_ids.size > limit

      # Track highest UID for next sync
      max_uid = message_ids.max

      # Fetch email data
      # Use BODY.PEEK[] instead of RFC822 to avoid marking emails as read
      message_ids.each_slice(50) do |batch|
        fetch_data = imap.uid_fetch(batch, [
          "UID",
          "BODY.PEEK[]",
          "ENVELOPE",
          "FLAGS",
          "INTERNALDATE"
        ])

        fetch_data&.each do |msg|
          email_data = parse_email_message(msg, folder)
          emails << email_data if email_data
        end
      end

      # Update last UID
      credential.update!(last_uid: max_uid) if max_uid
    end

    emails
  rescue => e
    Rails.logger.error "[ImapEmailService] Error fetching new emails: #{e.message}"
    raise
  end

  # Folders to sync from (INBOX + Sent folder variants for complete email history)
  # Different mail servers use different names for sent folder
  SYNC_FOLDERS = ["INBOX", "Sent Items", "Sent", "INBOX.Sent"].freeze

  # Sync emails to EmailWarehouse
  # @param full_sync [Boolean] Whether to do a full sync (all emails) or incremental
  # @return [Hash] Sync results
  def sync_to_warehouse(full_sync: false)
    results = { synced: 0, skipped: 0, errors: 0, new_emails: [] }

    begin
      # Sync from multiple folders
      all_emails = []
      SYNC_FOLDERS.each do |folder|
        # Use date-based sync for both full and incremental
        # UID-based sync was broken because UIDs are folder-specific but we stored one global last_uid
        since_date = if full_sync
                       90.days.ago
                     else
                       # For incremental, sync emails from last sync time minus 1 hour buffer
                       # The buffer handles timezone issues and any emails that arrived just before last sync
                       # Duplicates are handled by internet_message_id uniqueness check
                       (credential.last_synced_at || 7.days.ago) - 1.hour
                     end
        emails = fetch_emails(folder: folder, since: since_date, limit: full_sync ? 500 : 250)
        all_emails.concat(emails)
      rescue => e
        Rails.logger.warn "[ImapEmailService] Skipping folder #{folder}: #{e.message}"
      end

      all_emails.each do |email_data|
        begin
          # Check for existing email by message ID
          existing = EmailWarehouse.find_by(internet_message_id: email_data[:internet_message_id])

          if existing
            # Update read status from server (in case it changed)
            existing.update!(is_read: email_data[:is_read]) if existing.is_read != email_data[:is_read]
            results[:skipped] += 1
            next
          end

          # Create new email warehouse entry
          email = EmailWarehouse.create!(
            internet_message_id: email_data[:internet_message_id],
            source_type: "imap",
            imap_credential: credential,
            mailbox_owner_email: credential.email_address,  # SSoT: Required for filtering by mailbox
            uid: email_data[:uid],
            subject: email_data[:subject],
            body_text: email_data[:body_text],
            body_html: email_data[:body_html],
            from_email: email_data[:from_email],
            from_name: email_data[:from_name],
            to_emails: email_data[:to_emails],
            cc_emails: email_data[:cc_emails],
            received_at: email_data[:received_at],
            has_attachments: email_data[:has_attachments],
            attachment_count: email_data[:attachment_count],
            is_read: email_data[:is_read],
            folder_name: email_data[:folder_name],
            in_reply_to: email_data[:in_reply_to],
            references: email_data[:references],
            first_synced_at: Time.current,
            last_synced_at: Time.current,
            synced_by_user: credential.user
          )

          # Attach files if present
          attach_email_files(email, email_data[:attachments]) if email_data[:attachments].present?

          # Apply email rules to newly synced email
          apply_rules_to_email(email)

          results[:synced] += 1
          results[:new_emails] << email
        rescue ActiveRecord::RecordInvalid => e
          Rails.logger.warn "[ImapEmailService] Skipping invalid email: #{e.message}"
          results[:skipped] += 1
        rescue => e
          Rails.logger.error "[ImapEmailService] Error syncing email: #{e.message}"
          results[:errors] += 1
        end
      end

      credential.mark_sync_success!
    rescue => e
      credential.mark_sync_error!(e.message)
      raise
    end

    results
  end

  # Send email via SMTP
  # @param to [Array<String>] Recipient email addresses
  # @param subject [String] Email subject
  # @param body [String] Email body (HTML supported)
  # @param cc [Array<String>] CC recipients
  # @param bcc [Array<String>] BCC recipients
  # @param attachments [Array<Hash>] Array of {filename:, content:, content_type:}
  # @return [Mail::Message] Sent message
  def send_email(to:, subject:, body:, cc: [], bcc: [], attachments: [], reply_to_message_id: nil, from_address: nil)
    # Use from_address if provided (for aliases), otherwise use credential's email
    sender_address = from_address.presence || credential.email_address

    mail = Mail.new do |m|
      m.from    sender_address
      m.to      Array(to)
      m.cc      Array(cc) if cc.present?
      m.bcc     Array(bcc) if bcc.present?
      m.subject subject

      # Set reply headers if replying
      if reply_to_message_id.present?
        m.in_reply_to = reply_to_message_id
        m.references = reply_to_message_id
      end

      # Set body as HTML or text
      if body.include?("<") && body.include?(">")
        m.html_part do
          content_type "text/html; charset=UTF-8"
          body body
        end
        m.text_part do
          body ActionController::Base.helpers.strip_tags(body)
        end
      else
        m.body body
      end
    end

    # Add attachments
    attachments.each do |attachment|
      mail.add_file(
        filename: attachment[:filename],
        content: attachment[:content]
      )
    end

    # Configure SMTP delivery
    mail.delivery_method :smtp, smtp_settings

    # Send
    mail.deliver!

    # Save sent email to warehouse
    save_sent_email_to_warehouse(mail)

    mail
  rescue => e
    Rails.logger.error "[ImapEmailService] Error sending email: #{e.message}"
    raise
  end

  # List available IMAP folders
  # @return [Array<String>] Folder names
  def list_folders
    folders = []

    with_imap_connection do |imap|
      imap.list("", "*").each do |folder|
        folders << folder.name
      end
    end

    folders.sort
  rescue => e
    Rails.logger.error "[ImapEmailService] Error listing folders: #{e.message}"
    []
  end

  # Create a new folder on IMAP server
  # @param folder_name [String] Name of the folder to create
  # @return [Boolean] Success status
  def create_folder(folder_name)
    with_imap_connection do |imap|
      imap.create(folder_name)
    end
    true
  rescue Net::IMAP::NoResponseError => e
    Rails.logger.warn "[ImapEmailService] Folder creation failed: #{e.message}"
    false
  rescue => e
    Rails.logger.error "[ImapEmailService] Error creating folder: #{e.message}"
    false
  end

  # Delete a folder on IMAP server
  # @param folder_name [String] Name of the folder to delete
  # @return [Boolean] Success status
  def delete_folder(folder_name)
    with_imap_connection do |imap|
      imap.delete(folder_name)
    end
    true
  rescue => e
    Rails.logger.error "[ImapEmailService] Error deleting folder: #{e.message}"
    false
  end

  # Move email to a different folder
  # @param uid [Integer] UID of the email
  # @param destination_folder [String] Target folder name
  # @param source_folder [String] Source folder name (default: INBOX)
  # @return [Boolean] Success status
  def move_email(uid, destination_folder, source_folder: "INBOX")
    with_imap_connection do |imap|
      imap.select(source_folder)
      # Copy then delete (IMAP MOVE command isn't universally supported)
      imap.uid_copy(uid, destination_folder)
      imap.uid_store(uid, "+FLAGS", [:Deleted])
      imap.expunge
    end
    true
  rescue => e
    Rails.logger.error "[ImapEmailService] Error moving email: #{e.message}"
    false
  end

  # Delete email by UID
  # @param uid [Integer] UID of the email
  # @param folder [String] Folder containing the email (default: INBOX)
  # @return [Boolean] Success status
  def delete_email(uid, folder: "INBOX")
    with_imap_connection do |imap|
      imap.select(folder)
      imap.uid_store(uid, "+FLAGS", [:Deleted])
      imap.expunge
    end
    true
  rescue => e
    Rails.logger.error "[ImapEmailService] Error deleting email: #{e.message}"
    false
  end

  # Set flags on email
  # @param uid [Integer] UID of the email
  # @param flags [Array<Symbol>] Flags to set (e.g., [:Seen, :Flagged])
  # @param folder [String] Folder containing the email (default: INBOX)
  # @return [Boolean] Success status
  def set_flags(uid, flags, folder: "INBOX")
    with_imap_connection do |imap|
      imap.select(folder)
      imap.uid_store(uid, "+FLAGS", flags)
    end
    true
  rescue => e
    Rails.logger.error "[ImapEmailService] Error setting flags: #{e.message}"
    false
  end

  # Mark email as read/unread
  # @param uid [Integer] UID of the email
  # @param is_read [Boolean] Read status to set
  # @param folder [String] Folder containing the email (default: INBOX)
  # @return [Boolean] Success status
  def mark_read(uid, is_read:, folder: "INBOX")
    if is_read
      set_flags(uid, [:Seen], folder: folder)
    else
      remove_flags(uid, [:Seen], folder: folder)
    end
  end

  # Remove flags from email
  # @param uid [Integer] UID of the email
  # @param flags [Array<Symbol>] Flags to remove
  # @param folder [String] Folder containing the email (default: INBOX)
  # @return [Boolean] Success status
  def remove_flags(uid, flags, folder: "INBOX")
    with_imap_connection do |imap|
      imap.select(folder)
      imap.uid_store(uid, "-FLAGS", flags)
    end
    true
  rescue => e
    Rails.logger.error "[ImapEmailService] Error removing flags: #{e.message}"
    false
  end

  private

  def with_imap_connection
    imap = Net::IMAP.new(
      credential.imap_host,
      port: credential.imap_port,
      ssl: credential.imap_ssl
    )

    begin
      imap.login(credential.username, credential.password)
      yield imap
    ensure
      imap.logout rescue nil
      imap.disconnect rescue nil
    end
  end

  def smtp_settings
    {
      address: credential.smtp_host,
      port: credential.smtp_port,
      domain: credential.email_address.split("@").last,
      user_name: credential.username,
      password: credential.password,
      authentication: credential.smtp_auth.to_sym,
      enable_starttls_auto: credential.smtp_port == 587
    }
  end

  def build_search_criteria(since: nil)
    criteria = ["ALL"]

    if since.present?
      # IMAP date format: DD-Mon-YYYY
      date_str = since.strftime("%d-%b-%Y")
      criteria = ["SINCE", date_str]
    end

    criteria
  end

  def parse_email_message(msg, folder_name)
    return nil unless msg

    # Parse the raw message using Mail gem
    # BODY.PEEK[] returns data under "BODY[]" key (without PEEK)
    raw = msg.attr["BODY[]"] || msg.attr["RFC822"]
    return nil unless raw

    mail = Mail.read_from_string(raw)
    envelope = msg.attr["ENVELOPE"]
    flags = msg.attr["FLAGS"] || []
    uid = msg.attr["UID"]
    internal_date = msg.attr["INTERNALDATE"]

    # Extract message ID - generate fallback if missing
    message_id = mail.message_id || envelope&.message_id

    # Clean message ID (remove angle brackets if present)
    if message_id.present?
      message_id = message_id.gsub(/[<>]/, "")
    else
      # Generate a unique fallback message ID for emails without one
      # Using UID + folder + credential ensures uniqueness within the mailbox
      message_id = "imap-#{uid}-#{folder_name.parameterize}@#{credential.email_address.split('@').last}"
      Rails.logger.info "[ImapEmailService] Generated fallback message_id: #{message_id}"
    end

    # Extract body
    body_text = extract_text_body(mail)
    body_html = extract_html_body(mail)

    # Extract attachments info
    attachments = extract_attachments(mail)

    {
      uid: uid,
      internet_message_id: message_id,
      subject: mail.subject || envelope&.subject,
      from_email: mail.from&.first || extract_email_from_envelope(envelope&.from&.first),
      from_name: extract_name_from_address(mail.from&.first) || envelope&.from&.first&.name,
      to_emails: mail.to || extract_emails_from_envelope(envelope&.to),
      cc_emails: mail.cc || extract_emails_from_envelope(envelope&.cc),
      received_at: mail.date || (internal_date ? Time.parse(internal_date) : Time.current),
      is_read: flags.include?(:Seen),
      folder_name: folder_name,
      in_reply_to: mail.in_reply_to&.gsub(/[<>]/, ""),
      references: Array(mail.references).map { |r| r.gsub(/[<>]/, "") },
      has_attachments: attachments.any?,
      attachment_count: attachments.size,
      attachments: attachments,
      body_text: body_text,
      body_html: body_html
    }
  rescue => e
    Rails.logger.error "[ImapEmailService] Error parsing email: #{e.message}"
    nil
  end

  def extract_text_body(mail)
    if mail.multipart?
      text_part = mail.text_part
      text_part&.decoded rescue text_part&.body&.to_s
    else
      # Single-part email - only return as text if it's not HTML
      content_type = mail.content_type&.to_s&.downcase || ""
      if content_type.include?("text/html")
        nil  # HTML content goes to body_html, not body_text
      else
        mail.body.decoded rescue mail.body.to_s
      end
    end
  end

  def extract_html_body(mail)
    if mail.multipart?
      html_part = mail.html_part
      html_part&.decoded rescue html_part&.body&.to_s
    else
      # Single-part email - check if it's HTML
      content_type = mail.content_type&.to_s&.downcase || ""
      if content_type.include?("text/html")
        mail.body.decoded rescue mail.body.to_s
      else
        nil
      end
    end
  end

  def extract_attachments(mail)
    attachments = []

    mail.attachments.each do |attachment|
      attachments << {
        filename: attachment.filename,
        content_type: attachment.content_type,
        content: attachment.decoded,
        size: attachment.decoded.bytesize
      }
    end

    attachments
  rescue => e
    Rails.logger.warn "[ImapEmailService] Error extracting attachments: #{e.message}"
    []
  end

  def extract_email_from_envelope(addr)
    return nil unless addr
    "#{addr.mailbox}@#{addr.host}" if addr.mailbox && addr.host
  end

  def extract_emails_from_envelope(addrs)
    return [] unless addrs
    addrs.map { |a| extract_email_from_envelope(a) }.compact
  end

  def extract_name_from_address(addr)
    return nil unless addr.is_a?(Mail::Address)
    addr.display_name
  end

  def attach_email_files(email, attachments)
    # Note: has_many_attached :files was removed (Jan 2026) - create EmailAttachment records instead
    # SSoT: EmailAttachment uses store_content! for deduplicated storage via StorageBlob
    attachments.each do |attachment|
      next unless attachment[:content].present?

      email_attachment = email.email_attachments.create!(
        filename: attachment[:filename],
        content_type: attachment[:content_type],
        file_size: attachment[:content].bytesize
      )
      # SSoT: Use store_content! which handles deduplication via StorageBlob
      email_attachment.store_content!(
        attachment[:content],
        filename: attachment[:filename],
        content_type: attachment[:content_type]
      )
    end
  rescue => e
    Rails.logger.error "[ImapEmailService] Error attaching files: #{e.message}"
  end

  def apply_rules_to_email(email)
    return unless email && credential.user

    rule_service = EmailRuleService.new(credential.user)
    rule_service.apply_rules(email)
  rescue => e
    Rails.logger.warn "[ImapEmailService] Error applying rules to email #{email.id}: #{e.message}"
    # Don't raise - rules failing shouldn't stop sync
  end

  def save_sent_email_to_warehouse(mail)
    EmailWarehouse.create!(
      internet_message_id: mail.message_id.gsub(/[<>]/, ""),
      source_type: "imap",
      imap_credential: credential,
      mailbox_owner_email: credential.email_address,  # SSoT: Required for filtering by mailbox
      subject: mail.subject,
      body_text: mail.text_part&.decoded || mail.body.to_s,
      body_html: mail.html_part&.decoded,
      from_email: credential.email_address,
      from_name: credential.user.name,
      to_emails: Array(mail.to),
      cc_emails: Array(mail.cc),
      received_at: Time.current,
      sent_at: Time.current,
      folder_name: "Sent Items",  # SSoT: Use standard name, in_folder scope handles variations
      first_synced_at: Time.current,
      last_synced_at: Time.current,
      synced_by_user: credential.user
    )
  rescue => e
    Rails.logger.warn "[ImapEmailService] Could not save sent email to warehouse: #{e.message}"
  end
end
