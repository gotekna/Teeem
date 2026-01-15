class EmailWarehouse < ApplicationRecord
  include Searchable

  # Searchable columns for full-text search (GIN index)
  # Note: Uses custom update_searchable_vector callback instead of trigger
  searchable_columns :subject, :from_email, :body_text

  # Table renamed from email_warehouse to email_warehouses (Rails convention)

  # ActiveStorage attachments
  has_many_attached :files

  # File upload validation (security: prevents storage DoS and malware upload)
  # Email attachments can include various document types
  ALLOWED_EMAIL_ATTACHMENT_TYPES = %w[
    application/pdf
    image/jpeg image/png image/tiff image/gif image/heic
    application/vnd.openxmlformats-officedocument.wordprocessingml.document
    application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
    application/vnd.openxmlformats-officedocument.presentationml.presentation
    application/vnd.ms-excel application/msword application/vnd.ms-powerpoint
    text/plain text/csv text/html
    application/zip
  ].freeze

  validates :files, content_type: ALLOWED_EMAIL_ATTACHMENT_TYPES,
                    size: { less_than: 25.megabytes, message: "must be less than 25MB each" }

  # Associations
  belongs_to :job, optional: true
  belongs_to :synced_by_user, class_name: "User", optional: true
  belongs_to :ssot_owner, class_name: "User", optional: true  # User who owns the SSoT copy
  # SSoT: Use MicrosoftCredential
  belongs_to :microsoft_credential, class_name: "MicrosoftCredential", optional: true
  belongs_to :primary_contact, class_name: "Contact", optional: true
  belongs_to :imap_credential, optional: true  # For IMAP-sourced emails

  # SSoT associations
  has_many :email_recipients, dependent: :destroy
  has_many :email_attachments, dependent: :destroy
  has_many :attachments, through: :email_attachments

  # Email Labels (Gmail-style multi-label system)
  has_many :email_label_assignments, dependent: :destroy
  has_many :email_labels, through: :email_label_assignments

  # Email Snooze (temporarily hide and bring back later)
  has_many :email_snoozes, dependent: :destroy

  # Email User State (per-user pin, star, archive, reminders)
  has_many :email_user_states, dependent: :destroy

  # Task attachments
  has_many :sm_task_attachments, as: :attachable, dependent: :destroy
  has_many :attached_tasks, through: :sm_task_attachments, source: :sm_task

  # Direction constants (for SSoT tracking)
  DIRECTIONS = %w[sent received cc bcc].freeze

  # Validations
  validates :internet_message_id, presence: true, uniqueness: true

  # Callbacks - Real-time sync via ActionCable
  after_create_commit :broadcast_new_email
  after_create_commit :inherit_job_from_thread
  after_destroy_commit :broadcast_email_deleted

  # Scopes
  scope :unassigned, -> { where(job_id: nil) }
  scope :assigned, -> { where.not(job_id: nil) }
  scope :latest_in_thread, -> { where(is_latest_in_thread: true) }
  scope :by_conversation, ->(conv_id) { where(conversation_id: conv_id).order(received_at: :asc) }
  scope :recent_first, -> { order(received_at: :desc) }
  scope :for_job, ->(job_id) { where(job_id: job_id) }
  scope :received_after, ->(date) { where("received_at >= ?", date) }
  scope :received_before, ->(date) { where("received_at <= ?", date) }

  # SSoT scopes
  scope :owned_by, ->(user) { where(ssot_owner: user) }
  scope :with_ai_summary, -> { where.not(ai_summary: nil) }
  scope :needs_ai_summary, -> { where(ai_summary: nil) }
  scope :spam, -> { where("email_classification->>'email_type' = ?", "spam") }
  # Use IS DISTINCT FROM to properly handle: NULL classification, empty hash {}, and non-spam types
  scope :not_spam, -> { where("email_classification->>'email_type' IS DISTINCT FROM ?", "spam") }

  # Contact scopes
  scope :with_contact, ->(contact_id) { where("? = ANY(contact_ids)", contact_id) }
  scope :primary_contact, ->(contact_id) { where(primary_contact_id: contact_id) }
  scope :matched_to_contacts, -> { where.not(contacts_matched_at: nil) }
  scope :unmatched_to_contacts, -> { where(contacts_matched_at: nil) }

  # Microsoft organization scopes
  scope :for_microsoft_credential, ->(credential_id) { where(microsoft_credential_id: credential_id) }
  # SSoT: Use MicrosoftCredential table
  scope :for_microsoft_org, ->(org_name) {
    joins(:microsoft_credential).where(microsoft_credentials: { name: org_name })
  }

  # Source type scopes (outlook vs imap)
  scope :from_outlook, -> { where(source_type: "outlook") }
  scope :from_imap, -> { where(source_type: "imap") }
  scope :for_imap_credential, ->(credential_id) { where(imap_credential_id: credential_id) }

  # SSoT: Folder name filtering (case-insensitive)
  # ALWAYS use this scope instead of .where(folder_name: x) to handle provider variations
  # Gmail uses INBOX, Outlook uses Inbox, others may use inbox - this handles all cases
  # Match folder by name - supports both full path (e.g., "Inbox/Investments") and folder name only
  # This allows matching emails synced before full path support was added
  # Also handles Sent folder variations: "Sent", "Sent Items", "Sent Mail", "INBOX.Sent"
  SENT_FOLDER_VARIANTS = ["sent", "sent items", "sent mail", "inbox.sent"].freeze

  scope :in_folder, ->(name) {
    # Extract just the folder name (last part of path) for matching legacy emails
    folder_name_only = name.to_s.split("/").last
    normalized_name = name.to_s.downcase

    # Handle Sent folder variations - match all sent variants if searching for any sent folder
    if SENT_FOLDER_VARIANTS.include?(normalized_name)
      where("LOWER(folder_name) IN (?)", SENT_FOLDER_VARIANTS)
    else
      where("LOWER(folder_name) = LOWER(?) OR LOWER(folder_name) = LOWER(?)", name, folder_name_only)
    end
  }

  # Full-text search scope
  scope :search_text, ->(query) {
    where("searchable @@ plainto_tsquery('english', ?)", query)
  }

  # Search by email address (from, to, or cc)
  # Can accept a single email string or an array of emails
  # SSoT: All emails are stored lowercase (normalize_email_addresses callback)
  # Performance: Uses fast array overlap (&&) since data is normalized
  scope :involving_email, ->(emails) {
    emails = Array(emails).compact.map(&:downcase)
    return none if emails.empty?

    # Simple matching - all emails stored lowercase via before_save callback
    # Uses array overlap (&&) for fast GIN-indexed matching on to_emails/cc_emails
    where(
      "from_email = ANY(ARRAY[?]::text[]) OR " \
      "to_emails && ARRAY[?]::text[] OR " \
      "cc_emails && ARRAY[?]::text[]",
      emails, emails, emails
    )
  }

  # Callbacks
  before_save :normalize_email_addresses  # SSoT: All emails stored lowercase
  before_save :update_searchable_vector
  after_save :update_thread_latest_flags, if: :saved_change_to_conversation_id?

  # Class methods
  class << self
    # Find or create email from Outlook data, handling deduplication
    def upsert_from_outlook(outlook_data, synced_by_user: nil)
      message_id = outlook_data[:internet_message_id] || outlook_data[:message_id]
      return nil if message_id.blank?

      email = find_or_initialize_by(internet_message_id: message_id)

      email.assign_attributes(
        outlook_id: outlook_data[:outlook_id],
        conversation_id: outlook_data[:conversation_id],
        subject: outlook_data[:subject],
        body_text: outlook_data[:body_text] || outlook_data[:text_body],
        body_html: outlook_data[:body_html] || outlook_data[:html_body],
        from_email: outlook_data[:from_email] || outlook_data[:from],
        from_name: outlook_data[:from_name],
        to_emails: Array(outlook_data[:to_emails] || outlook_data[:to]),
        cc_emails: Array(outlook_data[:cc_emails] || outlook_data[:cc]),
        received_at: outlook_data[:received_at] || outlook_data[:date],
        sent_at: outlook_data[:sent_at],
        has_attachments: outlook_data[:has_attachments] || false,
        attachment_count: outlook_data[:attachment_count] || 0,
        importance: outlook_data[:importance],
        is_read: outlook_data[:is_read],
        folder_name: outlook_data[:folder_name],
        in_reply_to: outlook_data[:in_reply_to],
        references: Array(outlook_data[:references]),
        last_synced_at: Time.current
      )

      if email.new_record?
        email.synced_by_user = synced_by_user
        email.first_synced_at = Time.current
      end

      email.save!
      email
    end

    # Update is_latest_in_thread flags for a conversation
    def update_latest_flags_for_conversation(conversation_id)
      return if conversation_id.blank?

      emails = where(conversation_id: conversation_id).order(received_at: :desc)
      return if emails.empty?

      # Mark all as not latest first
      emails.update_all(is_latest_in_thread: false)

      # Mark the most recent as latest
      emails.first.update_column(:is_latest_in_thread, true)
    end

    # Performance: Batch update ALL thread flags in a single SQL statement
    # Impact: 20,000 queries → 2 queries
    # Part of 6-month email performance masterpiece plan
    def update_all_thread_flags_batch
      # Step 1: Mark all as not latest (single UPDATE)
      update_all(is_latest_in_thread: false)

      # Step 2: Mark latest per conversation using window function (single UPDATE)
      # This uses ROW_NUMBER() to find the most recent email in each conversation
      connection.execute(<<-SQL.squish)
        UPDATE email_warehouse
        SET is_latest_in_thread = true
        FROM (
          SELECT id
          FROM (
            SELECT id, ROW_NUMBER() OVER (
              PARTITION BY conversation_id
              ORDER BY received_at DESC NULLS LAST
            ) as rn
            FROM email_warehouse
            WHERE conversation_id IS NOT NULL
          ) ranked
          WHERE rn = 1
        ) latest
        WHERE email_warehouse.id = latest.id
      SQL

      # Also mark emails with no conversation_id as latest (they are their own thread)
      where(conversation_id: nil, is_latest_in_thread: false).update_all(is_latest_in_thread: true)
    end

    # Performance: Update thread flags only for recently synced emails
    # Use this after an incremental sync instead of update_all_thread_flags_batch
    def update_thread_flags_for_recent(since: 1.hour.ago)
      # Get conversation IDs that have been updated recently
      conversation_ids = where("last_synced_at > ?", since)
        .where.not(conversation_id: nil)
        .distinct
        .pluck(:conversation_id)

      return if conversation_ids.empty?

      # Update flags only for these conversations
      connection.execute(sanitize_sql_array([<<-SQL.squish, conversation_ids]))
        UPDATE email_warehouse
        SET is_latest_in_thread = false
        WHERE conversation_id = ANY(ARRAY[?]::text[])
      SQL

      connection.execute(sanitize_sql_array([<<-SQL.squish, conversation_ids]))
        UPDATE email_warehouse
        SET is_latest_in_thread = true
        FROM (
          SELECT id
          FROM (
            SELECT id, ROW_NUMBER() OVER (
              PARTITION BY conversation_id
              ORDER BY received_at DESC NULLS LAST
            ) as rn
            FROM email_warehouse
            WHERE conversation_id = ANY(ARRAY[?]::text[])
          ) ranked
          WHERE rn = 1
        ) latest
        WHERE email_warehouse.id = latest.id
      SQL
    end
  end

  # Instance methods

  # Get all emails in this conversation thread
  def conversation_thread
    return [ self ] if conversation_id.blank?
    self.class.by_conversation(conversation_id)
  end

  # Get count of emails in conversation
  def thread_count
    return 1 if conversation_id.blank?
    self.class.where(conversation_id: conversation_id).count
  end

  # Email classification helper methods

  # Check if email should be excluded from case/job matching (marketing, spam, transactional)
  def classified_as_irrelevant?
    classification = email_classification || {}
    %w[marketing spam transactional].include?(classification["email_type"]) &&
      classification["confidence"].to_f >= 0.5  # Aggressive threshold per user preference
  end

  # Check if email type is business-related (can match jobs/cases)
  def is_business_email?
    !classified_as_irrelevant?
  end

  # Get human-readable classification label
  def classification_label
    classification = email_classification || {}
    type = classification["email_type"] || "unclassified"
    confidence = classification["confidence"] || 0
    "#{type.titleize} (#{(confidence * 100).to_i}%)"
  end

  # Get document attachments only (exclude signature images and inline images)
  # Uses Active Storage files attached directly to EmailWarehouse
  def document_attachments
    files.select { |file| !file.content_type&.start_with?('image/') }
  end

  # Get count of document attachments (excluding images)
  def document_attachments_count
    files.count { |file| !file.content_type&.start_with?('image/') }
  end

  # Job ID patterns to look for in subject line
  # Matches: id:20, id.20, id;20, #20, job:20, job.20, job;20, [20], (20)
  JOB_ID_PATTERN = /(?:id|job)[:.\-;]\s*(\d+)|#(\d+)|\[(\d+)\]|\(job\s*(\d+)\)/i

  # Check if this email matches any job based on various criteria
  # Performance: Uses SQL-based trigram matching via JobAddressSearch
  # Impact: 10,000,000 Job objects/day → 3-5 SQL queries per email
  def find_matching_jobs
    matches = []

    # Skip matching if email is classified as irrelevant (marketing, spam, transactional)
    return matches if classified_as_irrelevant?

    # 1. EXPLICIT JOB ID IN SUBJECT - Always wins (user deliberately put it there)
    # e.g., forwarding old email with "id:32" should go to Job #32, not inherited job
    if subject.present?
      job_ids = extract_explicit_job_ids
      if job_ids.any?
        Job.where(id: job_ids).each do |job|
          matches << {
            job: job,
            match_type: "explicit_job_id",
            confidence: 1.0,
            reason: "Explicit job ID #{job.id} found in subject"
          }
        end
        # Return early - explicit ID is definitive
        return matches if matches.any?
      end
    end

    # 2. THREAD INHERITANCE: If another email in this conversation is assigned to a job, inherit it
    # Only applies when no explicit job ID in subject (e.g., repeat client like Pam with multiple jobs)
    if conversation_id.present?
      thread_job = EmailWarehouse
        .where(conversation_id: conversation_id)
        .where.not(job_id: nil)
        .where.not(id: id)
        .order(matched_at: :desc)
        .limit(1)
        .pick(:job_id)

      if thread_job.present?
        job = Job.find_by(id: thread_job)
        if job
          return [{
            job: job,
            match_type: "thread_inheritance",
            confidence: 1.0,
            reason: "Another email in this conversation is assigned to this job"
          }]
        end
      end
    end

    # 3. SQL-based address matching using trigram similarity (if table exists)
    # This replaces the slow Job.find_each loop with indexed SQL queries
    if subject.present? && subject.length >= 10 && JobAddressSearch.table_exists?
      matches.concat(find_jobs_via_address_search)
    end

    # 3. Contact email matching (batch query instead of N+1)
    matches.concat(find_jobs_via_contact_emails)

    # Deduplicate and sort by confidence
    matches
      .uniq { |m| m[:job].id }
      .sort_by { |m| -m[:confidence] }
  end

  private

  # Extract explicit job IDs from subject line
  def extract_explicit_job_ids
    return [] if subject.blank?
    subject.scan(JOB_ID_PATTERN).flatten.compact.map(&:to_i).select(&:positive?).uniq
  end

  # SQL-based address matching using JobAddressSearch trigram index
  # Replaces the slow Job.find_each loop
  def find_jobs_via_address_search
    matches = []
    return matches if subject.blank?

    subject_lower = subject.to_s.downcase.strip
    # Guard: pg_trgm similarity requires non-empty string
    return matches if subject_lower.blank? || subject_lower.length < 3

    # Sanitize for SQL - escape quotes and use connection quoting
    sanitized_subject = ActiveRecord::Base.connection.quote(subject_lower)

    # Query job_address_searches with trigram similarity
    # Uses GIN index for fast fuzzy matching
    address_matches = JobAddressSearch
      .where("search_term % ?", subject_lower)
      .where(term_type: %w[full_address street_name title])
      .select(Arel.sql("job_address_searches.*, similarity(search_term, #{sanitized_subject}) as match_score"))
      .order("match_score DESC")
      .includes(:job)
      .limit(10)

    address_matches.each do |search|
      next if search.match_score < 0.3  # Minimum similarity threshold

      confidence = case search.term_type
      when 'full_address' then search.match_score * 0.9
      when 'street_name' then search.match_score * 0.75
      when 'title' then search.match_score * 0.7
      else search.match_score * 0.5
      end

      matches << {
        job: search.job,
        match_type: "#{search.term_type}_match",
        confidence: confidence,
        reason: "#{search.term_type.humanize} '#{search.search_term}' matches (#{(search.match_score * 100).to_i}% similarity)"
      }
    end

    matches
  end

  # Batch contact email matching (replaces N+1 Contact.where loop)
  def find_jobs_via_contact_emails
    matches = []
    all_emails = [from_email, *to_emails, *cc_emails].compact.map(&:downcase).uniq
    return matches if all_emails.empty?

    # Single query to find all jobs linked to these email addresses
    contact_jobs = Job
      .joins(job_contacts: { contact: :contact_emails })
      .where("LOWER(contact_emails.email) IN (?)", all_emails)
      .distinct
      .select("jobs.*, contact_emails.email as matched_email")

    contact_jobs.each do |job|
      # Only match if email has job-specific context (stricter filtering)
      next unless email_mentions_job_context?(job)

      matches << {
        job: job,
        match_type: "contact_email_with_context",
        confidence: 0.75,
        reason: "Email #{job.matched_email} is linked to job contact"
      }
    end

    matches
  end

  public

  # Check if email mentions job-specific context (used for filtering false positives)
  # Checks both subject AND body for job address/name mentions
  def email_mentions_job_context?(job)
    return false if job.nil?

    # Combine subject and body for searching
    searchable_text = "#{subject} #{body_text}".downcase

    # Check for job ID
    return true if searchable_text.include?(job.id.to_s)

    # Check for job name/address
    return true if job.name.present? && searchable_text.include?(job.name.downcase)

    # Check for street name match (handles partial addresses)
    if job.name.present?
      street_match = job.name.match(/\d+\s+(.+?)\s+(Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Court|Ct|Place|Pl)/i)
      if street_match
        street_name = street_match[1].downcase
        return true if searchable_text.include?(street_name)
      end
    end

    # Check against job's indexed search terms (includes suburbs, variations)
    job.job_address_searches.each do |search|
      return true if searchable_text.include?(search.search_term)
    end

    # No job-specific context found
    false
  end

  # Find ALL jobs this email might belong to (scans body for addresses)
  # Returns array of { job:, match_type:, confidence:, reason: }
  def find_potential_job_matches
    matches = []

    # Get all job address search terms and find matches in email content
    searchable_text = "#{subject} #{body_text}".downcase
    return matches if searchable_text.blank?

    # Find jobs via address search terms in body
    JobAddressSearch.where(term_type: %w[full_address street_name]).find_each do |search|
      next unless searchable_text.include?(search.search_term)

      confidence = case search.term_type
      when 'full_address' then 0.85
      when 'street_name' then 0.7
      else 0.5
      end

      matches << {
        job: search.job,
        match_type: "body_#{search.term_type}_match",
        confidence: confidence,
        reason: "Email body contains '#{search.search_term}'"
      }
    end

    # Deduplicate by job ID, keeping highest confidence
    matches
      .group_by { |m| m[:job].id }
      .map { |_job_id, job_matches| job_matches.max_by { |m| m[:confidence] } }
      .sort_by { |m| -m[:confidence] }
  end

  # Auto-assign to best matching job if confidence is high enough
  def auto_assign_to_job!(min_confidence: 0.8)
    return if job_id.present?  # Already assigned

    matches = find_matching_jobs
    best_match = matches.first

    return nil unless best_match && best_match[:confidence] >= min_confidence

    update!(
      job: best_match[:job],
      match_type: "auto",
      match_confidence: best_match[:confidence],
      matched_at: Time.current
    )

    best_match[:job]
  end

  # Manually assign to job
  def assign_to_job!(job, by_user: nil)
    update!(
      job: job,
      match_type: "manual",
      match_confidence: 1.0,
      matched_at: Time.current
    )
  end

  # Formatted display helpers
  def preview_body(length: 200)
    (body_text || "").truncate(length)
  end

  def all_recipients
    (to_emails + cc_emails).compact.uniq
  end

  def display_from
    from_name.presence || from_email
  end

  # SSoT helper methods

  # Get email .eml storage path (provider-agnostic)
  # Returns storage_path (new) or falls back to sharepoint_email_path (legacy)
  def email_storage_path
    storage_path.presence || sharepoint_email_path
  end

  # Get email storage file ID (provider-agnostic)
  def email_storage_file_id
    storage_file_id.presence || sharepoint_email_file_id
  end

  # Check if email .eml is stored
  def eml_stored?
    email_storage_path.present?
  end

  # Determine direction based on folder and user email
  def determine_direction(user_email)
    return "sent" if folder_name&.downcase&.include?("sent")
    return "sent" if from_email&.downcase == user_email&.downcase

    if to_emails&.any? { |e| e.downcase == user_email&.downcase }
      "received"
    elsif cc_emails&.any? { |e| e.downcase == user_email&.downcase }
      "cc"
    else
      "received"  # Default for inbox
    end
  end

  # Direction accessor - uses mailbox_owner_email if available, otherwise infers from folder
  def direction
    if mailbox_owner_email.present?
      determine_direction(mailbox_owner_email)
    elsif folder_name&.downcase&.include?("sent")
      "sent"
    else
      "received"
    end
  end

  # Set SSoT owner (sender owns sent emails, syncing user owns received)
  def set_ssot_owner!(syncing_user)
    if direction == "sent"
      # Sender owns sent emails
      owner = User.find_by("LOWER(email) = ?", from_email&.downcase) || syncing_user
    else
      # Receiver owns received emails
      owner = syncing_user
    end

    update!(ssot_owner: owner)
  end

  # Generate body preview from body_text
  def generate_body_preview!
    return if body_text.blank?

    preview = body_text.to_s
      .gsub(/\s+/, " ")  # Normalize whitespace
      .strip
      .truncate(500)

    update!(body_preview: preview)
  end

  # Build email recipients from existing to/cc/from fields
  # Performance: Uses batch lookups to avoid N+1 queries
  # Impact: 10,000 queries/day → 2 queries per email batch
  def build_recipients!
    # Clear existing recipients
    email_recipients.destroy_all

    # Collect all unique email addresses
    all_emails = []
    all_emails << { email: from_email, type: "from" } if from_email.present?
    to_emails&.each { |e| all_emails << { email: e, type: "to" } }
    cc_emails&.each { |e| all_emails << { email: e, type: "cc" } }

    return if all_emails.empty?

    # Normalize and dedupe for batch lookups
    unique_emails = all_emails.map { |e| e[:email].to_s.downcase.strip }.uniq

    # Batch load users and contacts (2 queries instead of N*2)
    users_by_email = User.where("LOWER(email) IN (?)", unique_emails)
                         .index_by { |u| u.email.downcase }

    # SSoT: Contact emails live in contact_emails table, not on Contact model
    contact_email_records = ContactEmail.where("LOWER(email) IN (?)", unique_emails).includes(:contact)
    contacts_by_email = contact_email_records.each_with_object({}) do |ce, hash|
      hash[ce.email.downcase] = ce.contact if ce.contact
    end

    # Create recipients with preloaded data
    all_emails.each do |entry|
      normalized_email = entry[:email].to_s.downcase.strip
      next if normalized_email.blank?

      recipient = email_recipients.build(
        email_address: normalized_email,
        recipient_type: entry[:type]
      )

      # Match to user or contact using preloaded cache
      if users_by_email[normalized_email]
        recipient.user = users_by_email[normalized_email]
        recipient.is_internal = true
      elsif contacts_by_email[normalized_email]
        recipient.contact = contacts_by_email[normalized_email]
        recipient.is_internal = false
      end
    end

    save!
  end

  # Check if this email is spam
  def spam?
    email_classification&.dig("email_type") == "spam"
  end

  # Mark as spam and optionally delete from Outlook
  def mark_as_spam!(delete_from_outlook: false, outlook_service: nil)
    update!(
      user_classification: "spam",
      email_classification: (email_classification || {}).merge("email_type" => "spam", "user_override" => true)
    )

    if delete_from_outlook && outlook_service && outlook_id.present?
      outlook_service.delete_email(outlook_id)
    end
  end

  # Extract text from all attached PDF files
  # SSoT: Uses PdfTextExtractionService for all PDF text extraction
  def extract_pdf_text
    return nil unless files.attached?

    pdf_texts = []

    files.each do |file|
      next unless file.content_type == "application/pdf"

      begin
        result = PdfTextExtractionService.extract(file.blob, join_pages: true)
        next unless result[:success]

        pdf_texts << {
          filename: file.filename.to_s,
          text: result[:text],
          pages: result[:page_count]
        }
      rescue StandardError => e
        Rails.logger.error "Failed to extract PDF text from #{file.filename}: #{e.message}"
      end
    end

    pdf_texts.presence
  end

  # Sync ALL attachments from Microsoft 365 to local storage (SSoT)
  # This ensures downloads always work, even if SharePoint/Outlook are unavailable
  # SSoT: Uses org-level credentials via MicrosoftAppGraphClient
  # Options:
  #   force: true - re-sync even if files already attached (for fixing missing attachments)
  def sync_attachments!(force: false)
    return unless outlook_id.present? && has_attachments
    return if files.attached? && !force  # Already synced (unless forced)

    # SSoT: Use MicrosoftCredential
    credential = if microsoft_credential_id.present?
                   MicrosoftCredential.find_by(id: microsoft_credential_id)
                 else
                   MicrosoftCredential.app_credentials.connected.first
                 end

    unless credential&.valid_credential?
      Rails.logger.warn "[EmailWarehouse] No valid org credential for attachment sync on email #{id}"
      return
    end

    # Need the mailbox email to fetch attachments from
    mailbox = mailbox_owner_email
    unless mailbox.present?
      Rails.logger.warn "[EmailWarehouse] No mailbox_owner_email for attachment sync on email #{id}"
      return
    end

    begin
      client = MicrosoftAppGraphClient.new(credential)
      attachments = client.get_email_attachments(mailbox, outlook_id)

      attachments.each do |attachment|
        content_type = attachment["contentType"]&.downcase

        # SSoT: Use EmailAttachmentFilterService to skip signatures/embedded/non-file attachments
        next if EmailAttachmentFilterService.should_skip?(attachment)

        # Only download allowed file types (security)
        next unless ALLOWED_EMAIL_ATTACHMENT_TYPES.any? { |t| content_type&.start_with?(t.split("/").first) }

        file_data = client.download_email_attachment(mailbox, outlook_id, attachment["id"])
        next unless file_data

        # Skip if file is too large (> 25MB)
        next if file_data[:content].bytesize > 25.megabytes

        # Skip if file already attached (for force re-sync)
        next if files.any? { |f| f.filename.to_s == file_data[:filename] }

        # Attach to EmailWarehouse using ActiveStorage
        files.attach(
          io: StringIO.new(file_data[:content]),
          filename: file_data[:filename],
          content_type: file_data[:content_type]
        )

        Rails.logger.info "[EmailWarehouse] Attached #{file_data[:filename]} (#{file_data[:content_type]}) to email #{id}"
      end
    rescue StandardError => e
      Rails.logger.error "[EmailWarehouse] Failed to sync attachments for email #{id}: #{e.message}"
    end
  end

  private

  # SSoT: Normalize all email addresses to lowercase before saving
  # This ensures case-insensitive matching works with simple equality checks
  # FRC: Fix at source (storage) not at query time (LOWER() in every query)
  def normalize_email_addresses
    self.from_email = from_email&.downcase
    self.to_emails = to_emails&.map(&:downcase) if to_emails.present?
    self.cc_emails = cc_emails&.map(&:downcase) if cc_emails.present?
  end

  def update_searchable_vector
    # Build searchable text from various fields
    searchable_text = [
      subject,
      from_email,
      from_name,
      to_emails&.join(" "),
      cc_emails&.join(" "),
      body_text
    ].compact.join(" ")

    # Use PostgreSQL to_tsvector
    self.searchable = self.class.connection.execute(
      self.class.sanitize_sql_array([
        "SELECT to_tsvector('english', ?)",
        searchable_text
      ])
    ).first["to_tsvector"]
  rescue StandardError => e
    Rails.logger.error "Failed to update searchable vector: #{e.message}"
  end

  def update_thread_latest_flags
    self.class.update_latest_flags_for_conversation(conversation_id)
  end

  # Broadcast new email to the owner via ActionCable
  def broadcast_new_email
    return unless ssot_owner_id.present?

    EmailChannel.broadcast_new_email(ssot_owner, self)
  rescue StandardError => e
    Rails.logger.error "Failed to broadcast new email: #{e.message}"
  end

  # Auto-assign to job if another email in this conversation thread is already assigned
  # This ensures email threads stay together on the same job (e.g., Pam builds multiple jobs,
  # once user assigns one email from a thread to Job #46, all future replies auto-assign)
  # EXCEPTION: If email has explicit job ID in subject (e.g., "id:32"), that wins
  def inherit_job_from_thread
    return if job_id.present?  # Already assigned
    return if conversation_id.blank?  # No thread to inherit from

    # Check for explicit job ID in subject first - that always wins
    if subject.present?
      explicit_ids = subject.scan(JOB_ID_PATTERN).flatten.compact.map(&:to_i).select(&:positive?)
      if explicit_ids.any?
        job = Job.find_by(id: explicit_ids.first)
        if job
          update_columns(
            job_id: job.id,
            match_type: "explicit_job_id",
            match_confidence: 1.0,
            matched_at: Time.current
          )
          Rails.logger.info "[EmailWarehouse] Auto-assigned email #{id} to job #{job.id} via explicit ID in subject"
          return
        end
      end
    end

    # Find job from another email in the same thread
    thread_job_id = EmailWarehouse
      .where(conversation_id: conversation_id)
      .where.not(job_id: nil)
      .where.not(id: id)
      .limit(1)
      .pick(:job_id)

    return unless thread_job_id

    update_columns(
      job_id: thread_job_id,
      match_type: "thread_inheritance",
      match_confidence: 1.0,
      matched_at: Time.current
    )

    Rails.logger.info "[EmailWarehouse] Auto-assigned email #{id} to job #{thread_job_id} via thread inheritance"
  rescue StandardError => e
    Rails.logger.error "[EmailWarehouse] Failed to inherit job from thread: #{e.message}"
  end

  # Broadcast email deletion to the owner via ActionCable
  def broadcast_email_deleted
    return unless ssot_owner_id.present?

    EmailChannel.broadcast_email_deleted(ssot_owner, id)
  rescue StandardError => e
    Rails.logger.error "Failed to broadcast email deletion: #{e.message}"
  end
end
