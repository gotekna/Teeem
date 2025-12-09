# EmailSharePointService - Store emails in SharePoint as SSoT
#
# This service stores email content in SharePoint/OneDrive instead of the database.
# Benefits:
#   - Reduces database size (body_text can be very large)
#   - Single source of truth for email content
#   - Better attachment handling
#   - Accessible via SharePoint web UI
#
# Folder Structure:
#   /Documents/Emails/{@domain}/{user@domain}/{year}/{month}/{date} - {subject}.eml
#
# Example:
#   /Documents/Emails/@tekna.com.au/robert@tekna.com.au/2024/12 - December/2024-12-08 1430 - RE Meeting notes.eml
#
# Usage:
#   service = EmailSharePointService.new
#   service.save_to_sharepoint(email_warehouse)
#   service.fetch_body(email_warehouse)
#   service.sync_all_pending(limit: 100)

class EmailSharePointService
  # OneDrive path - store under Emails folder
  EMAILS_FOLDER = "Emails"

  # Tekna internal domains - all go under @tekna.com.au folder
  TEKNA_DOMAINS = %w[tekna.com.au].freeze

  class NotConnectedError < StandardError; end
  class UploadError < StandardError; end

  attr_reader :client, :results, :credential

  def initialize
    @credential = OrganizationOneDriveCredential.active_credential
    raise NotConnectedError, "No Organization OneDrive configured" unless @credential

    @client = MicrosoftGraphClient.new(@credential)
    @results = {
      processed: 0,
      uploaded: 0,
      skipped: 0,
      errors: []
    }
  end

  # Save a single email to SharePoint
  # Returns the SharePoint file info or nil on failure
  def save_to_sharepoint(email)
    return nil if email.sharepoint_file_id.present?  # Already saved

    # Determine owner email (sender for sent, ssot_owner for received)
    owner_email = if email.direction == "sent"
      email.from_email
    else
      email.ssot_owner&.email || email.to_emails&.first || email.from_email
    end

    # Get domain folder and user folder
    domain_folder = get_domain_folder(owner_email)
    user_folder = sanitize_folder_name(owner_email)

    # Build path: /Emails/{@domain}/{user@domain}/{year}/{month}/
    year = email.received_at&.year || Time.current.year
    month = email.received_at&.strftime("%m - %B") || "00 - Unknown"

    folder_path = "#{EMAILS_FOLDER}/#{domain_folder}/#{user_folder}/#{year}/#{month}"

    # Build filename: {date} - {subject}.eml
    date_str = email.received_at&.strftime("%Y-%m-%d %H%M") || "unknown"
    subject_clean = sanitize_filename(email.subject || "No Subject")
    filename = "#{date_str} - #{subject_clean}.eml"

    # Generate .eml content
    eml_content = generate_eml_content(email)

    # Ensure folder exists and upload
    begin
      ensure_folder_exists(folder_path)
      file_info = upload_file(folder_path, filename, eml_content)

      # Update email record with SharePoint info
      email.update!(
        sharepoint_file_id: file_info[:id],
        sharepoint_path: "#{folder_path}/#{filename}",
        sharepoint_synced_at: Time.current
      )

      @results[:uploaded] += 1
      Rails.logger.info "[EmailSharePoint] Saved email #{email.id} to #{folder_path}/#{filename}"
      file_info
    rescue StandardError => e
      @results[:errors] << { email_id: email.id, error: e.message }
      Rails.logger.error "[EmailSharePoint] Failed to save email #{email.id}: #{e.message}"
      nil
    end
  end

  # Fetch email body from SharePoint (lazy load)
  def fetch_body(email)
    return email.body_text if email.body_text.present?  # Still in DB
    return nil unless email.sharepoint_file_id.present?

    begin
      # Download .eml file from SharePoint
      eml_content = download_file(email.sharepoint_file_id)
      return nil unless eml_content

      # Parse .eml to extract body
      mail = Mail.read_from_string(eml_content)
      extract_body_from_mail(mail)
    rescue StandardError => e
      Rails.logger.error "[EmailSharePoint] Failed to fetch body for email #{email.id}: #{e.message}"
      nil
    end
  end

  # Sync all pending emails to SharePoint
  def sync_all_pending(limit: 100, only_business: true)
    scope = EmailWarehouse.pending_sharepoint_sync
    scope = scope.not_spam if only_business
    scope = scope.limit(limit).order(received_at: :desc)

    scope.find_each do |email|
      @results[:processed] += 1
      save_to_sharepoint(email)
    end

    @results
  end

  # Sync emails for a specific domain only
  def sync_domain(domain, limit: 100)
    domain_pattern = "%@#{domain}"

    scope = EmailWarehouse.pending_sharepoint_sync
      .where("from_email ILIKE ? OR EXISTS (SELECT 1 FROM unnest(to_emails) AS e WHERE e ILIKE ?)",
             domain_pattern, domain_pattern)
      .limit(limit)
      .order(received_at: :desc)

    scope.find_each do |email|
      @results[:processed] += 1
      save_to_sharepoint(email)
    end

    @results
  end

  # Sync emails for a specific user only
  def sync_user(user_email, limit: 100)
    scope = EmailWarehouse.pending_sharepoint_sync
      .where("from_email ILIKE ? OR EXISTS (SELECT 1 FROM unnest(to_emails) AS e WHERE e ILIKE ?)",
             user_email, user_email)
      .limit(limit)
      .order(received_at: :desc)

    scope.find_each do |email|
      @results[:processed] += 1
      save_to_sharepoint(email)
    end

    @results
  end

  # Clear body_text from database after syncing to SharePoint
  # This reduces database size significantly
  def clear_synced_bodies(limit: 100)
    cleared = 0

    EmailWarehouse.synced_to_sharepoint
      .where.not(body_text: nil)
      .limit(limit)
      .find_each do |email|
        # Ensure we have a preview before clearing
        email.generate_body_preview! if email.body_preview.blank?

        # Clear the large body_text field
        email.update!(body_text: nil, body_html: nil)
        cleared += 1
      end

    { cleared: cleared }
  end

  # Get SharePoint stats
  def stats
    {
      total_emails: EmailWarehouse.count,
      synced_to_sharepoint: EmailWarehouse.synced_to_sharepoint.count,
      pending_sync: EmailWarehouse.pending_sharepoint_sync.count,
      with_body_text: EmailWarehouse.where.not(body_text: nil).count,
      body_cleared: EmailWarehouse.synced_to_sharepoint.where(body_text: nil).count
    }
  end

  private

  # Get the domain folder name for an email address
  # e.g., robert@tekna.com.au -> @tekna.com.au
  def get_domain_folder(email_address)
    return "@external" if email_address.blank?

    domain = email_address.to_s.split("@").last&.downcase
    return "@external" if domain.blank?

    # Consolidate Tekna domains under one folder
    if TEKNA_DOMAINS.include?(domain)
      "@tekna.com.au"
    else
      "@#{domain}"
    end
  end

  # Generate RFC 2822 compliant .eml content
  def generate_eml_content(email)
    mail = Mail.new do |m|
      m.message_id    email.internet_message_id
      m.subject       email.subject
      m.from          email.from_email
      m.to            email.to_emails
      m.cc            email.cc_emails if email.cc_emails.present?
      m.date          email.received_at || email.sent_at
    end

    # Add body parts
    if email.body_html.present? && email.body_text.present?
      mail.text_part = Mail::Part.new do
        content_type "text/plain; charset=UTF-8"
        body email.body_text
      end
      mail.html_part = Mail::Part.new do
        content_type "text/html; charset=UTF-8"
        body email.body_html
      end
    elsif email.body_html.present?
      mail.content_type = "text/html; charset=UTF-8"
      mail.body = email.body_html
    elsif email.body_text.present?
      mail.content_type = "text/plain; charset=UTF-8"
      mail.body = email.body_text
    end

    # Add custom headers for TEEEM tracking
    mail["In-Reply-To"] = email.in_reply_to if email.in_reply_to.present?
    mail["X-TEEEM-Email-ID"] = email.id.to_s
    mail["X-TEEEM-Conversation-ID"] = email.conversation_id if email.conversation_id.present?
    mail["X-TEEEM-Job-ID"] = email.job_id.to_s if email.job_id.present?

    mail.to_s
  end

  # Extract body from parsed Mail object
  def extract_body_from_mail(mail)
    if mail.multipart?
      text_part = mail.text_part
      return text_part.decoded if text_part

      html_part = mail.html_part
      strip_html(html_part.decoded) if html_part
    else
      mail.decoded
    end
  rescue StandardError => e
    Rails.logger.error "[EmailSharePoint] Failed to extract body: #{e.message}"
    nil
  end

  # Strip HTML tags for plain text extraction
  def strip_html(html)
    html.to_s
      .gsub(/<style[^>]*>.*?<\/style>/mi, "")
      .gsub(/<script[^>]*>.*?<\/script>/mi, "")
      .gsub(/<[^>]+>/, " ")
      .gsub(/&nbsp;/, " ")
      .gsub(/&amp;/, "&")
      .gsub(/&lt;/, "<")
      .gsub(/&gt;/, ">")
      .gsub(/\s+/, " ")
      .strip
  end

  # Get drive path prefix for Graph API calls
  def drive_path
    @credential.drive_id ? "/drives/#{@credential.drive_id}" : "/me/drive"
  end

  # Ensure a folder path exists, creating folders as needed
  def ensure_folder_exists(folder_path)
    path_parts = folder_path.split("/")
    current_path = ""

    path_parts.each do |folder_name|
      parent_path = current_path.presence || "root"
      current_path = current_path.present? ? "#{current_path}/#{folder_name}" : folder_name

      begin
        # Try to access the folder - if it exists, continue
        # URL encode the path to handle spaces and special characters
        encoded_path = current_path.split("/").map { |s| CGI.escape(s) }.join("/")
        @client.get("#{drive_path}/root:/#{encoded_path}")
      rescue MicrosoftGraphClient::APIError => e
        # Folder doesn't exist, create it
        create_folder(parent_path, folder_name)
      end
    end
  end

  # Create a folder in OneDrive
  def create_folder(parent_path, folder_name)
    endpoint = if parent_path == "root"
      "#{drive_path}/root/children"
    else
      # URL encode the parent path to handle spaces and special characters
      encoded_parent = parent_path.split("/").map { |s| CGI.escape(s) }.join("/")
      "#{drive_path}/root:/#{encoded_parent}:/children"
    end

    body = {
      name: folder_name,
      folder: {},
      "@microsoft.graph.conflictBehavior" => "replace"
    }

    begin
      @client.post(endpoint, body)
    rescue MicrosoftGraphClient::APIError => e
      # Ignore "name already exists" errors
      raise UploadError, "Failed to create folder '#{folder_name}': #{e.message}" unless e.message.include?("nameAlreadyExists")
    end
  end

  # Upload a file to OneDrive
  def upload_file(folder_path, filename, content)
    # For small files (< 4MB), use simple upload
    # URL encode the folder path and filename to handle spaces and special characters
    encoded_folder = folder_path.split("/").map { |s| CGI.escape(s) }.join("/")
    endpoint = "#{drive_path}/root:/#{encoded_folder}/#{CGI.escape(filename)}:/content"

    result = @client.put(endpoint, content, { "Content-Type" => "message/rfc822" })

    {
      id: result["id"],
      name: result["name"],
      web_url: result["webUrl"],
      size: result["size"]
    }
  rescue MicrosoftGraphClient::APIError => e
    raise UploadError, "Failed to upload '#{filename}': #{e.message}"
  end

  # Download a file from OneDrive by file ID
  def download_file(file_id)
    @client.download_file(file_id)
  rescue MicrosoftGraphClient::APIError => e
    Rails.logger.error "[EmailSharePoint] Failed to download file #{file_id}: #{e.message}"
    nil
  end

  # Sanitize folder name (remove invalid SharePoint characters)
  def sanitize_folder_name(name)
    name.to_s
      .gsub(/[<>:"\/\\|?*]/, "_")
      .truncate(100, omission: "")
      .strip
  end

  # Sanitize filename for SharePoint
  def sanitize_filename(name)
    name.to_s
      .gsub(/[<>:"\/\\|?*\r\n]/, "_")
      .gsub(/\s+/, " ")
      .truncate(80, omission: "")
      .strip
  end
end
