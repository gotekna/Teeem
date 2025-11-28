class EmailWarehouseSyncService
  BATCH_SIZE = 100  # Emails per API call
  DEFAULT_SYNC_YEARS = 3  # Go back 3 years
  FOLDERS_TO_SYNC = ['inbox', 'sentitems']  # Sync both inbox and sent

  class SyncError < StandardError; end

  def initialize(user)
    @user = user
    @outlook_service = OutlookService.new(user)
    @sync_status = EmailSyncStatus.find_or_create_by(user: user)
  end

  # Full initial sync - goes back 3 years
  def full_sync!
    return if @sync_status.sync_in_progress?

    @sync_status.mark_syncing!
    total_synced = 0

    begin
      FOLDERS_TO_SYNC.each do |folder|
        synced = sync_folder(folder, since: DEFAULT_SYNC_YEARS.years.ago)
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

      FOLDERS_TO_SYNC.each do |folder|
        synced = sync_folder(folder, since: since)
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

    search_terms.each do |term|
      FOLDERS_TO_SYNC.each do |folder|
        emails = @outlook_service.search_emails(
          search: term,
          folder: folder,
          top: 200
        )

        emails.each do |email_data|
          warehouse_email = EmailWarehouse.upsert_from_outlook(
            email_data.merge(folder_name: folder),
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

  def sync_folder(folder, since:)
    synced_count = 0
    skip = 0

    loop do
      # Build filter for emails since date
      filter = "receivedDateTime ge #{since.utc.iso8601}"

      emails = fetch_emails_batch(folder, filter, skip)
      break if emails.empty?

      emails.each do |email_data|
        EmailWarehouse.upsert_from_outlook(
          email_data.merge(folder_name: folder),
          synced_by_user: @user
        )
        synced_count += 1
      end

      # If we got less than batch size, we're done
      break if emails.size < BATCH_SIZE

      skip += BATCH_SIZE

      # Safety valve - don't sync more than 10k emails per folder
      break if skip >= 10_000
    end

    synced_count
  end

  def fetch_emails_batch(folder, filter, skip)
    # Use the Graph API directly for more control
    endpoint = "/me/mailFolders/#{folder}/messages"
    params = [
      "$filter=#{URI.encode_www_form_component(filter)}",
      "$top=#{BATCH_SIZE}",
      "$skip=#{skip}",
      "$orderby=receivedDateTime DESC",
      "$select=id,subject,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,hasAttachments,body,internetMessageId,conversationId,importance,isRead,inReplyTo"
    ]

    url = "#{OutlookService::GRAPH_API_BASE}#{endpoint}?#{params.join('&')}"
    Rails.logger.info "[EmailSync] Fetching from: #{folder}, skip: #{skip}"

    response = make_graph_request(url)

    unless response.is_a?(Net::HTTPSuccess)
      Rails.logger.error "[EmailSync] API error: #{response.code} - #{response.body}"
      return []
    end

    data = JSON.parse(response.body)
    emails = parse_outlook_emails(data['value'] || [])
    Rails.logger.info "[EmailSync] Fetched #{emails.count} emails from #{folder}"
    emails
  rescue StandardError => e
    Rails.logger.error "[EmailSync] Failed to fetch emails: #{e.class} - #{e.message}"
    Rails.logger.error e.backtrace.first(5).join("\n")
    []
  end

  def parse_outlook_emails(emails)
    emails.map do |email|
      {
        internet_message_id: email['internetMessageId'],
        outlook_id: email['id'],
        conversation_id: email['conversationId'],
        subject: email['subject'],
        body_text: email.dig('body', 'contentType') == 'text' ? email.dig('body', 'content') : nil,
        body_html: email.dig('body', 'contentType') == 'html' ? email.dig('body', 'content') : nil,
        from_email: email.dig('from', 'emailAddress', 'address'),
        from_name: email.dig('from', 'emailAddress', 'name'),
        to_emails: email['toRecipients']&.map { |r| r.dig('emailAddress', 'address') } || [],
        cc_emails: email['ccRecipients']&.map { |r| r.dig('emailAddress', 'address') } || [],
        received_at: email['receivedDateTime'],
        sent_at: email['sentDateTime'],
        has_attachments: email['hasAttachments'] || false,
        importance: email['importance'],
        is_read: email['isRead'],
        in_reply_to: email['inReplyTo']
      }
    end
  end

  def make_graph_request(url)
    credential = @user.outlook_credential
    raise SyncError, 'Outlook not connected' unless credential

    access_token = credential.valid_access_token

    uri = URI(url)
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true

    request = Net::HTTP::Get.new(uri.request_uri)
    request['Authorization'] = "Bearer #{access_token}"
    request['Content-Type'] = 'application/json'

    http.request(request)
  end

  def build_job_search_terms(job)
    terms = []

    # Add job title/address
    terms << job.title if job.title.present?

    # Add street name
    if job.title.present?
      street_match = job.title.match(/\d+\s+(.+?)\s+(Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Court|Ct|Place|Pl)/i)
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
      .where('created_at > ?', 1.hour.ago)
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
    EmailWarehouse.unassigned.where('created_at > ?', since).find_each do |email|
      email.auto_assign_to_job!(min_confidence: 0.8)
    rescue StandardError => e
      Rails.logger.error "Auto-match failed for email #{email.id}: #{e.message}"
    end
  end
end
