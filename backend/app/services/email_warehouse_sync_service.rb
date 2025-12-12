require "cgi"

class EmailWarehouseSyncService
  BATCH_SIZE = 100  # Emails per API call
  DEFAULT_SYNC_YEARS = 3  # Go back 3 years

  class SyncError < StandardError; end

  def initialize(user)
    @user = user
    @outlook_service = OutlookService.new(user)
    @sync_status = EmailSyncStatus.find_or_create_by(user: user)
  end

  # Full initial sync - goes back 3 years, syncs ALL folders
  def full_sync!
    return if @sync_status.sync_in_progress?

    @sync_status.mark_syncing!
    total_synced = 0

    begin
      # Fetch all mail folders dynamically
      folders = fetch_all_mail_folders
      Rails.logger.info "[EmailSync] Found #{folders.count} mail folders to sync"

      folders.each do |folder|
        Rails.logger.info "[EmailSync] Syncing folder: #{folder[:name]} (#{folder[:id]})"
        synced = sync_folder_by_id(folder[:id], folder[:name], since: DEFAULT_SYNC_YEARS.years.ago)
        total_synced += synced
      end

      # Update thread latest flags for all conversations
      update_all_thread_flags

      # Run auto-matching on unassigned emails
      auto_match_unassigned_emails

      @sync_status.mark_completed!(total_synced)
      Rails.logger.info "Full email sync completed for user #{@user.id}: #{total_synced} emails"
      total_synced
    rescue StandardError => e
      @sync_status.mark_failed!(e.message)
      Rails.logger.error "Email sync failed for user #{@user.id}: #{e.message}"
      raise SyncError, e.message
    end
  end

  # Incremental sync - only new emails since last sync
  def incremental_sync!
    return if @sync_status.sync_in_progress?

    @sync_status.mark_syncing!
    total_synced = 0

    begin
      # Default to last 24 hours if no previous sync
      since = @sync_status.last_sync_at || 24.hours.ago

      # Fetch all mail folders dynamically
      folders = fetch_all_mail_folders

      folders.each do |folder|
        synced = sync_folder_by_id(folder[:id], folder[:name], since: since)
        total_synced += synced
      end

      # Update thread flags for affected conversations
      update_recent_thread_flags

      # Auto-match only newly synced unassigned emails
      auto_match_recent_emails(since)

      @sync_status.mark_completed!(total_synced)
      Rails.logger.info "Incremental sync completed for user #{@user.id}: #{total_synced} emails"
      total_synced
    rescue StandardError => e
      @sync_status.mark_failed!(e.message)
      Rails.logger.error "Incremental sync failed for user #{@user.id}: #{e.message}"
      raise SyncError, e.message
    end
  end

  # Sync emails for a specific job (search by address/contacts)
  def sync_for_job(job)
    search_terms = build_job_search_terms(job)
    return 0 if search_terms.empty?

    total_synced = 0
    folders = fetch_all_mail_folders

    search_terms.each do |term|
      folders.each do |folder|
        emails = @outlook_service.search_emails(
          search: term,
          folder: folder[:id],
          top: 200
        )

        emails.each do |email_data|
          warehouse_email = EmailWarehouse.upsert_from_outlook(
            email_data.merge(folder_name: folder[:name]),
            synced_by_user: @user
          )

          if warehouse_email && warehouse_email.job_id.nil?
            warehouse_email.assign_to_job!(job)
            total_synced += 1
          end
        end
      end
    end

    total_synced
  end

  private

  # Fetch all mail folders from Graph API (including subfolders)
  def fetch_all_mail_folders
    folders = []

    # Get top-level folders
    url = "#{OutlookService::GRAPH_API_BASE}/me/mailFolders?$top=100"
    response = make_graph_request(url)

    return folders unless response.is_a?(Net::HTTPSuccess)

    data = JSON.parse(response.body)
    top_folders = data["value"] || []

    top_folders.each do |folder|
      # Skip folders we don't want (Deleted Items, Junk, etc.)
      next if folder["displayName"].in?([ "Deleted Items", "Junk Email", "Conversation History", "Sync Issues" ])

      folders << { id: folder["id"], name: folder["displayName"] }

      # Get child folders (subfolders)
      if folder["childFolderCount"].to_i > 0
        child_folders = fetch_child_folders(folder["id"], folder["displayName"])
        folders.concat(child_folders)
      end
    end

    folders
  rescue StandardError => e
    Rails.logger.error "[EmailSync] Failed to fetch mail folders: #{e.message}"
    # Fallback to basic folders if API fails
    [ { id: "inbox", name: "Inbox" }, { id: "sentitems", name: "Sent Items" } ]
  end

  # Recursively fetch child folders
  def fetch_child_folders(parent_id, parent_name, depth = 0)
    return [] if depth > 3 # Prevent infinite recursion

    folders = []
    url = "#{OutlookService::GRAPH_API_BASE}/me/mailFolders/#{parent_id}/childFolders?$top=100"
    response = make_graph_request(url)

    return folders unless response.is_a?(Net::HTTPSuccess)

    data = JSON.parse(response.body)
    child_folders = data["value"] || []

    child_folders.each do |folder|
      folder_path = "#{parent_name}/#{folder['displayName']}"
      folders << { id: folder["id"], name: folder_path }

      # Recurse into grandchildren
      if folder["childFolderCount"].to_i > 0
        grandchildren = fetch_child_folders(folder["id"], folder_path, depth + 1)
        folders.concat(grandchildren)
      end
    end

    folders
  rescue StandardError => e
    Rails.logger.error "[EmailSync] Failed to fetch child folders for #{parent_name}: #{e.message}"
    []
  end

  # Sync a folder by its ID (works for any folder including subfolders)
  def sync_folder_by_id(folder_id, folder_name, since:)
    synced_count = 0
    skip = 0

    loop do
      # Build filter for emails since date
      filter = "receivedDateTime ge #{since.utc.iso8601}"

      emails = fetch_emails_batch(folder_id, filter, skip)
      break if emails.empty?

      emails.each do |email_data|
        email = EmailWarehouse.upsert_from_outlook(
          email_data.merge(folder_name: folder_name),
          synced_by_user: @user
        )

        # Classify email using heuristics (and queue for AI if uncertain)
        if email&.persisted? && !ENV["DISABLE_EMAIL_CLASSIFICATION"]
          EmailClassificationService.new(email).classify!
        end

        synced_count += 1
      end

      # If we got less than batch size, we're done
      break if emails.size < BATCH_SIZE

      skip += BATCH_SIZE

      # Safety valve - don't sync more than 10k emails per folder
      break if skip >= 10_000
    end

    Rails.logger.info "[EmailSync] Synced #{synced_count} emails from #{folder_name}"
    synced_count
  end

  def fetch_emails_batch(folder_id, filter, skip)
    # Use the Graph API directly for more control
    endpoint = "/me/mailFolders/#{folder_id}/messages"
    params = [
      "$filter=#{URI.encode_www_form_component(filter)}",
      "$top=#{BATCH_SIZE}",
      "$skip=#{skip}",
      "$orderby=receivedDateTime DESC",
      "$select=id,subject,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,hasAttachments,body,internetMessageId,conversationId,importance,isRead,internetMessageHeaders"
    ]

    url = "#{OutlookService::GRAPH_API_BASE}#{endpoint}?#{params.join('&')}"

    response = make_graph_request(url)

    unless response.is_a?(Net::HTTPSuccess)
      Rails.logger.error "[EmailSync] API error for folder #{folder_id}: #{response.code} - #{response.body}"
      return []
    end

    data = JSON.parse(response.body)
    emails = parse_outlook_emails(data["value"] || [])
    emails
  rescue StandardError => e
    Rails.logger.error "[EmailSync] Failed to fetch emails: #{e.class} - #{e.message}"
    Rails.logger.error e.backtrace.first(5).join("\n")
    []
  end

  def parse_outlook_emails(emails)
    emails.map do |email|
      body_content = email.dig("body", "content")
      content_type = email.dig("body", "contentType")

      # Extract plain text from HTML if needed
      if content_type == "html" && body_content.present?
        body_html = body_content
        body_text = extract_text_from_html(body_content)
      elsif content_type == "text" && body_content.present?
        body_text = body_content
        body_html = nil
      else
        body_text = nil
        body_html = nil
      end

      {
        internet_message_id: email["internetMessageId"],
        outlook_id: email["id"],
        conversation_id: email["conversationId"],
        subject: email["subject"],
        body_text: body_text,
        body_html: body_html,
        from_email: email.dig("from", "emailAddress", "address"),
        from_name: email.dig("from", "emailAddress", "name"),
        to_emails: email["toRecipients"]&.map { |r| r.dig("emailAddress", "address") } || [],
        cc_emails: email["ccRecipients"]&.map { |r| r.dig("emailAddress", "address") } || [],
        received_at: email["receivedDateTime"],
        sent_at: email["sentDateTime"],
        has_attachments: email["hasAttachments"] || false,
        importance: email["importance"],
        is_read: email["isRead"],
        internet_headers: parse_internet_headers(email["internetMessageHeaders"])
      }
    end
  end

  # Extract plain text from HTML email body
  def extract_text_from_html(html)
    return nil if html.blank?

    # Remove script and style tags and their content
    text = html.gsub(/<script[^>]*>.*?<\/script>/mi, "")
    text = text.gsub(/<style[^>]*>.*?<\/style>/mi, "")

    # Replace <br> and block elements with newlines
    text = text.gsub(/<br\s*\/?>/i, "\n")
    text = text.gsub(/<\/(p|div|tr|li|h[1-6])>/i, "\n")

    # Remove all remaining HTML tags
    text = text.gsub(/<[^>]+>/, "")

    # Decode HTML entities
    text = CGI.unescapeHTML(text)

    # Clean up whitespace
    text = text.gsub(/\r\n/, "\n")           # Normalize line endings
    text = text.gsub(/[ \t]+/, " ")          # Collapse horizontal whitespace
    text = text.gsub(/\n{3,}/, "\n\n")       # Collapse multiple blank lines
    text = text.strip

    text.presence
  rescue => e
    Rails.logger.warn "[EmailSync] Failed to extract text from HTML: #{e.message}"
    nil
  end

  # Parse internet headers from Graph API format to hash
  def parse_internet_headers(headers_array)
    return {} unless headers_array.is_a?(Array)

    headers_array.each_with_object({}) do |header, hash|
      hash[header["name"]] = header["value"] if header["name"] && header["value"]
    end
  end

  def make_graph_request(url)
    credential = @user.outlook_credential
    raise SyncError, "Outlook not connected" unless credential

    access_token = credential.valid_access_token

    uri = URI(url)
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true

    request = Net::HTTP::Get.new(uri.request_uri)
    request["Authorization"] = "Bearer #{access_token}"
    request["Content-Type"] = "application/json"

    http.request(request)
  end

  def build_job_search_terms(job)
    terms = []

    # Add job name/address
    terms << job.name if job.name.present?

    # Add street name
    if job.name.present?
      street_match = job.name.match(/\d+\s+(.+?)\s+(Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Court|Ct|Place|Pl)/i)
      terms << street_match[1] if street_match
    end

    # Add contact emails
    job.contacts.each do |contact|
      terms << "from:#{contact.email}" if contact.email.present?
    end

    terms.compact.uniq
  end

  def update_all_thread_flags
    EmailWarehouse.distinct.pluck(:conversation_id).compact.each do |conv_id|
      EmailWarehouse.update_latest_flags_for_conversation(conv_id)
    end
  end

  def update_recent_thread_flags
    recent_conversations = EmailWarehouse
      .where("created_at > ?", 1.hour.ago)
      .distinct
      .pluck(:conversation_id)
      .compact

    recent_conversations.each do |conv_id|
      EmailWarehouse.update_latest_flags_for_conversation(conv_id)
    end
  end

  def auto_match_unassigned_emails
    EmailWarehouse.unassigned.find_each do |email|
      email.auto_assign_to_job!(min_confidence: 0.8)
    rescue StandardError => e
      Rails.logger.error "Auto-match failed for email #{email.id}: #{e.message}"
    end
  end

  def auto_match_recent_emails(since)
    EmailWarehouse.unassigned.where("created_at > ?", since).find_each do |email|
      email.auto_assign_to_job!(min_confidence: 0.8)
    rescue StandardError => e
      Rails.logger.error "Auto-match failed for email #{email.id}: #{e.message}"
    end
  end
end
