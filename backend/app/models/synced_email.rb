# Renamed from EmailWarehouse (Jan 2026)
# Part of the "Warehouse" table rename initiative - these are synced email records
# from Microsoft 365/IMAP, not part of the File Warehouse system.
class SyncedEmail < ApplicationRecord
  # Keep table name explicit during transition (after migration, this can be removed)
  self.table_name = "synced_emails"

  # Multi-tenancy: Scope all queries to current tenant (Tenant model is SSoT)
  acts_as_tenant :tenant

  include Searchable
  include MimeTypes

  # Searchable columns for full-text search (GIN index)
  # Note: Uses custom update_searchable_vector callback instead of trigger
  searchable_columns :subject, :from_email, :body_text

  # SSoT: Email attachments use WarehouseDocument with source_type='email_attachment' (Jan 2026)
  # Use attachment_documents method to query attachments for this email.

  # Associations
  belongs_to :job, optional: true
  belongs_to :synced_by_user, class_name: "User", optional: true
  belongs_to :ssot_owner, class_name: "User", optional: true  # User who owns the SSoT copy
  # SSoT: Use MicrosoftCredential
  belongs_to :microsoft_credential, class_name: "MicrosoftCredential", optional: true
  belongs_to :primary_contact, class_name: "Contact", optional: true
  belongs_to :imap_credential, optional: true  # For IMAP-sourced emails
  # Phase 4: Virtual File Warehouse - FK to EmailMailbox for virtual folder organization
  # Enables grouping emails by mailbox: Emails/{{Mailbox}}/Email Body/{{Year}}/{{Month}}
  belongs_to :email_mailbox, optional: true

  # SSoT associations
  # Note: All these associations use email_warehouse_id FK (historical naming - email_warehouse was renamed to synced_email)
  has_many :email_recipients, foreign_key: :email_warehouse_id, dependent: :destroy
  # Note: email_attachments table DROPPED (Jan 2026) - use attachment_documents method instead

  # Email Labels (Gmail-style multi-label system)
  # Note: email_label_assignments uses email_warehouse_id FK (historical naming)
  has_many :email_label_assignments, foreign_key: :email_warehouse_id, dependent: :destroy
  has_many :email_labels, through: :email_label_assignments

  # Email Snooze (temporarily hide and bring back later)
  # Note: email_snoozes uses email_warehouse_id FK (historical naming)
  has_many :email_snoozes, foreign_key: :email_warehouse_id, dependent: :destroy

  # Email User State (per-user pin, star, archive, reminders)
  # Note: email_user_states uses email_warehouse_id FK (historical naming - email_warehouse was renamed to synced_email)
  has_many :email_user_states, foreign_key: :email_warehouse_id, dependent: :destroy

  # Task attachments
  has_many :sm_task_attachments, as: :attachable, dependent: :destroy
  has_many :attached_tasks, through: :sm_task_attachments, source: :sm_task

  # Phase 3: Universal warehouse metadata (SSoT for ui_name, download_name, folder)
  # The .eml file itself uses SendNameResolver with download_name template "{Subject} - {ReceivedDate}.eml"
  has_one :warehouse_document, as: :documentable, dependent: :destroy

  # Ultra Email Architecture: Store Once, Link Many
  # One email can appear in multiple mailboxes (e.g., sent to multiple recipients).
  # Each mailbox appearance has its own outlook_id, folder_name, and is_read status.
  # SSoT: Email content here (once). Mailbox appearances in SyncedEmailMailbox.
  has_many :mailbox_appearances, class_name: 'SyncedEmailMailbox', dependent: :destroy

  # Direction constants (for SSoT tracking)
  DIRECTIONS = %w[sent received cc bcc].freeze

  # Validations
  validates :internet_message_id, presence: true, uniqueness: { scope: :tenant_id }

  # Callbacks - Real-time sync via ActionCable
  after_create_commit :broadcast_new_email
  after_create_commit :inherit_job_from_thread
  after_create_commit :inherit_task_from_thread
  after_destroy_commit :broadcast_email_deleted
  # NOTE (Feb 2026 FRC Fix): Removed update_warehouse_document_folder callback
  # Folder paths are now computed at runtime - no sync needed
  # Phase 4: Ensure warehouse_document exists when storage_path is set
  after_save :ensure_warehouse_document, if: :saved_change_to_storage_path?

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
            FROM synced_emails
            WHERE conversation_id IS NOT NULL
          ) ranked
          WHERE rn = 1
        ) latest
        WHERE synced_email.id = latest.id
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
            FROM synced_emails
            WHERE conversation_id = ANY(ARRAY[?]::text[])
          ) ranked
          WHERE rn = 1
        ) latest
        WHERE synced_email.id = latest.id
      SQL
    end
  end

  # Instance methods

  # ========================================
  # Ultra Email Architecture: Mailbox Helpers
  # ========================================

  # Check if email appears in a specific mailbox
  def in_mailbox?(mailbox_email)
    mailbox_appearances.for_mailbox(mailbox_email).exists?
  end

  # Get all mailboxes this email appears in
  def mailbox_emails
    mailbox_appearances.pluck(:mailbox_owner_email)
  end

  # Get mailbox appearance for a specific mailbox
  def mailbox_appearance_for(mailbox_email)
    mailbox_appearances.for_mailbox(mailbox_email).first
  end

  # Get or create mailbox appearance (used during sync)
  # Supports both MS365 (outlook_id, microsoft_credential_id) and IMAP (uid, imap_credential_id)
  #
  # ⚠️ FRC (Feb 2026): Don't overwrite credential_id/outlook_id on existing appearances!
  # Root cause: When multiple credentials share a Microsoft tenant (sync_all: true),
  # they all sync the same mailboxes. The uniqueness key is (synced_email_id, mailbox_owner_email),
  # so the LAST credential to run would overwrite the credential_id. This broke the email list
  # query which filtered by credential_id on the join table.
  # Fix: Only set credential_id and outlook_id on NEW appearances. For existing ones,
  # only update folder_name and is_read (which are genuinely per-sync-run values).
  def ensure_mailbox_appearance(mailbox_email:, outlook_id: nil, uid: nil, folder_name: nil, is_read: false, microsoft_credential_id: nil, imap_credential_id: nil)
    appearance = mailbox_appearances.find_or_initialize_by(
      mailbox_owner_email: mailbox_email.downcase
    )

    if appearance.new_record?
      # New appearance - set all fields including credential ownership
      appearance.assign_attributes(
        outlook_id: outlook_id,
        uid: uid,
        folder_name: folder_name,
        is_read: is_read,
        microsoft_credential_id: microsoft_credential_id,
        imap_credential_id: imap_credential_id
      )
    else
      # Existing appearance - only update mutable fields, preserve credential ownership
      appearance.assign_attributes(
        folder_name: folder_name,
        is_read: is_read
      )
      # Only update credential/outlook_id if this is the SAME credential (not a different one overwriting)
      if appearance.microsoft_credential_id == microsoft_credential_id || appearance.microsoft_credential_id.nil?
        appearance.outlook_id = outlook_id if outlook_id.present?
        appearance.microsoft_credential_id = microsoft_credential_id if microsoft_credential_id.present?
      end
      if appearance.imap_credential_id == imap_credential_id || appearance.imap_credential_id.nil?
        appearance.uid = uid if uid.present?
        appearance.imap_credential_id = imap_credential_id if imap_credential_id.present?
      end
    end

    appearance.save!
    appearance
  end

  # ========================================
  # Thread / Conversation Methods
  # ========================================

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

  # SSoT: Get attachment documents for this email via WarehouseDocument (Jan 2026)
  # Returns WarehouseDocument records linked to this email
  # SSoT (Feb 2026): linkable FK is THE ONE way to link attachments to emails.
  # Previously used metadata->>'synced_email_id' (JSON query, no FK, no integrity).
  # linkable is a proper polymorphic FK with index — faster and Rails-standard.
  # metadata['synced_email_id'] is kept as audit data, not for querying.
  def attachment_documents
    WarehouseDocument.where(source_type: 'email_attachment', linkable_type: 'SyncedEmail', linkable_id: id)
  end

  # Get document attachments (exclude small signature images, keep large photos)
  # SSoT: Same 50KB threshold as sync_attachments!
  # - Images >= 50KB = real photos (construction site, documents) → INCLUDE
  # - Images < 50KB = likely email signatures → EXCLUDE
  # - Non-images (PDF, EML, etc.) → ALWAYS INCLUDE
  def document_attachments
    attachment_documents.select { |doc| include_attachment_doc?(doc) }
  end

  # Get count of document attachments (excluding small signature images)
  def document_attachments_count
    attachment_documents.count { |doc| include_attachment_doc?(doc) }
  end

  # SSoT: Determines if an attachment should be shown in document lists
  # Matches the sync logic threshold of 50KB for filtering signature images
  def include_attachment_doc?(doc)
    content_type = doc.content_type || doc.storage_blob&.content_type
    file_size = doc.file_size || doc.storage_blob&.file_size || 0

    # Non-images always included
    return true unless content_type&.start_with?('image/')

    # Large images (>= 50KB) included - likely real photos
    # Small images (< 50KB) excluded - likely signatures
    file_size >= 50_000
  end

  # ========================================
  # Phase 4: Virtual File Warehouse
  # ========================================

  # Invalid characters for folder names (Windows + Unix combined)
  INVALID_FOLDER_CHARS = /[:\/*?"<>|\\]/

  # Compute virtual folder path for organizing emails
  # Reads template from WarehouseProvider.path_for(:email)
  # Default template: "{{Mailbox}}/Email Body/{{Year}}/{{Month}}"
  #
  # Available tokens:
  # - {{Mailbox}} - email address (e.g., robert@tekna.com.au)
  # - {{Subject}} - sanitized email subject (e.g., RE Invoice Question)
  # - {{Year}} - 4-digit year (e.g., 2026)
  # - {{Month}} - 2-digit month (e.g., 01)
  # - {{ReceivedTime}} - time received HH-MM (e.g., 14-30)
  #
  # Used for:
  # - Setting WarehouseDocument.folder_path for database-driven folder rendering
  # - Instant reorganization (change mailbox_owner_email = instant move)
  #
  # Physical storage stays at Blobs/{hash}.eml (never moves)
  def virtual_folder_path
    resolve_virtual_path(:email)
  end

  # Compute virtual folder path for email attachments
  # SSoT: Now uses same path as email (attachments appear alongside .eml files)
  # Configure at: /settings/company/warehouse-config → Warehouse Folders → Emails
  def virtual_attachments_folder_path
    resolve_virtual_path(:email_attachments)
  end

  private

  # Resolve virtual path using template from WarehouseProvider
  # No fallback - if template is nil, that's a config error that should be fixed
  def resolve_virtual_path(scope)
    # Get template from WarehouseProvider (SSoT)
    config = WarehouseProvider.instance
    template = config&.path_for(scope)
    raise "WarehouseProvider missing :#{scope} template - run rails warehouse:init" unless template

    # Build substitution values
    mailbox_name = email_mailbox&.email_address || mailbox_owner_email || "Unknown"
    received = received_at || Time.current
    sanitized_subject = sanitize_for_folder(subject || "No Subject")

    # Replace all tokens
    result = template.dup
    result.gsub!("{{Mailbox}}", mailbox_name)
    result.gsub!("{{Subject}}", sanitized_subject)
    result.gsub!("{{Year}}", received.year.to_s)
    result.gsub!("{{Month}}", format("%02d", received.month))
    result.gsub!("{{ReceivedTime}}", received.strftime("%H-%M"))

    result
  end


  # Sanitize text for use in folder names
  def sanitize_for_folder(text)
    return "Unknown" if text.blank?

    text.to_s
        .gsub(INVALID_FOLDER_CHARS, " ")  # Remove invalid chars
        .gsub(/\s+/, " ")                  # Collapse whitespace
        .strip
        .truncate(100, omission: "")       # Limit length for filesystem
        .presence || "Unknown"
  end

  public

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
      thread_job = SyncedEmail
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
        confidence: EmailConstants::CONTACT_MATCH_CONFIDENCE,
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
  def auto_assign_to_job!(min_confidence: EmailConstants::DEFAULT_AUTO_ASSIGN_CONFIDENCE)
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
  # Returns storage_path (new) or falls back to storage_email_path (legacy column)
  def email_storage_path
    storage_path.presence || storage_email_path
  end

  # Get email storage file ID (provider-agnostic)
  def email_storage_file_id
    storage_file_id.presence || storage_email_file_id
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
  # SSoT: Uses OcrTextExtractorService for all PDF text extraction
  # Note: Uses WarehouseDocument (Jan 2026 - email_attachments table dropped)
  def extract_pdf_text
    return nil unless attachment_documents.any?

    pdf_texts = []

    attachment_documents.each do |doc|
      content_type = doc.content_type || doc.storage_blob&.content_type
      next unless content_type == PDF
      next unless doc.storage_blob.present?

      begin
        content = doc.storage_blob.download
        next unless content.present?

        result = OcrTextExtractorService.extract(content, join_pages: true)
        next unless result[:success]

        pdf_texts << {
          filename: doc.original_filename || doc.ui_name,
          text: result[:text],
          pages: result[:page_count]
        }
      rescue StandardError => e
        Rails.logger.error "Failed to extract PDF text from #{doc.ui_name}: #{e.message}"
      end
    end

    pdf_texts.presence
  end

  # SSoT: Try to link attachments from related emails without downloading
  # Checks same internet_message_id (exact copy in another mailbox) or conversation_id (thread)
  # Returns true if attachments were linked, false if download still needed
  # Two-step aware (Feb 2026): Also copies blobless metadata docs (pending downloads)
  def link_existing_attachments!
    return false unless has_attachments
    return false if attachment_documents.any?

    # Find related emails with synced attachments (via WarehouseDocument)
    # Include blobless docs too - they carry metadata (outlook_attachment_id) for later download
    related_with_attachments = SyncedEmail.where.not(id: id)
      .where(has_attachments: true)
      .joins("INNER JOIN warehouse_documents ON warehouse_documents.metadata->>'synced_email_id' = synced_emails.id::text")
      .where(warehouse_documents: { source_type: 'email_attachment' })

    # Priority 1: Same internet_message_id (exact same email, different mailbox)
    if internet_message_id.present?
      source = related_with_attachments.find_by(internet_message_id: internet_message_id)
      if source
        Rails.logger.info "[SyncedEmail] Linking attachments from email #{source.id} (same internet_message_id)"
        return copy_attachments_from!(source)
      end
    end

    # Priority 2: Same conversation_id (thread) with matching subject
    if conversation_id.present?
      source = related_with_attachments.where(conversation_id: conversation_id).first
      if source
        Rails.logger.info "[SyncedEmail] Linking attachments from email #{source.id} (same conversation_id)"
        return copy_attachments_from!(source)
      end
    end

    false
  end

  # Copy attachments from another email, linking to same StorageBlobs via WarehouseDocument
  # Two-step aware (Feb 2026): Also copies blobless metadata docs for later download
  def copy_attachments_from!(source_email)
    source_email.attachment_documents.each do |src_doc|
      # Copy the document - with or without blob (two-step: metadata survives without blob)
      WarehouseDocumentCreator.find_or_create!(
        find_by: {
          source_type: "email_attachment",
          linkable: self,
          metadata_match: { "outlook_attachment_id" => src_doc.metadata&.dig("outlook_attachment_id") }.compact
        },
        filename: src_doc.ui_name,
        source_type: "email_attachment",
        linkable: self,
        storage_blob: src_doc.storage_blob,
        file_size: src_doc.file_size,
        content_type: src_doc.content_type,
        metadata: {
          "synced_email_id" => id.to_s,
          "mailbox" => mailbox_owner_email,
          "outlook_attachment_id" => src_doc.metadata&.dig("outlook_attachment_id"),
          "blob_status" => src_doc.storage_blob_id.present? ? "downloaded" : "pending"
        }.compact
      )

      src_doc.storage_blob&.increment!(:reference_count) if src_doc.storage_blob_id.present?
      Rails.logger.debug "[SyncedEmail] Linked attachment: #{src_doc.ui_name} → blob #{src_doc.storage_blob_id || 'pending'}"
    end

    # Update attachment count
    new_count = attachment_documents.reload.count
    update_column(:attachment_count, new_count) if new_count > 0

    new_count > 0
  end

  # SSoT: Sync attachments from Microsoft Graph to WarehouseDocument + StorageBlob
  # Called automatically for new emails with attachments via OrgEmailSyncJob
  # FRC (Jan 2026): Microsoft reports has_attachments=false for inline images only.
  # Check body for cid: references to catch inline images that need syncing.
  # SSoT: Wasabi is THE ONE storage for attachments. No fallbacks.
  # Per-attachment dedup (line-by-line) ensures missing ones get synced
  # even if some already exist.
  #
  # FRC (Feb 2026): Legacy fields (microsoft_credential_id, outlook_id, mailbox_owner_email)
  # are set by the FIRST sync and never updated. For emails in "decommissioned" mailboxes
  # (e.g., lyw.org.au), the legacy credential may 404. We now fall back to
  # SyncedEmailMailbox appearances which may have a working credential+outlook_id pair.
  def sync_attachments!(force: false)
    has_inline_images = body_html&.include?('cid:')
    return unless has_attachments || has_inline_images

    # FRC (Feb 2026): StorageBlob.upload_to_storage! needs tenant context to find
    # the storage provider (Wasabi/S3). Without this, blob creation fails with
    # "Tenant context required" when called from rake tasks or background jobs.
    # SyncedEmail acts_as_tenant :tenant, so self.tenant is always available.
    ActsAsTenant.with_tenant(tenant) do
      # SSoT: Try linking existing attachments first (don't re-download)
      link_existing_attachments!

      # Try Microsoft Graph first, then IMAP fallback
      if sync_attachments_via_graph!
        update_column(:attachment_count, attachment_documents.reload.count)
        return
      end

      if sync_attachments_via_imap!
        update_column(:attachment_count, attachment_documents.reload.count)
        return
      end

      Rails.logger.warn "[SyncedEmail] Cannot sync attachments for #{id} - no working credential (Graph or IMAP)"
    end
  end

  private

  # Fetch attachments via Microsoft Graph API.
  # Two-step approach (Feb 2026 optimization):
  #   1) List attachment metadata only (~1KB) to check for real attachments
  #   2) Download only real attachments individually (skip inline signature images)
  # This avoids downloading ~300KB+ of base64 content for emails with only signature images.
  def sync_attachments_via_graph!
    graph_attempts = build_graph_credential_attempts
    return false if graph_attempts.empty?

    used_client = nil
    used_mailbox = nil
    used_attempt = nil
    attachment_metadata = nil

    # Step 1: Find a working credential and list attachment metadata (fast)
    graph_attempts.each do |attempt|
      cred = MicrosoftCredential.find_by(id: attempt[:credential_id])
      next unless cred&.status == "connected"

      begin
        client = MicrosoftAppGraphClient.new(cred)
        attachment_metadata = client.list_email_attachments(attempt[:mailbox], attempt[:outlook_id])
        used_client = client
        used_mailbox = attempt[:mailbox]
        used_attempt = attempt
        break
      rescue Microsoft::BaseClient::ApiError => e
        # 404 = mailbox not found in tenant, 403 = credential can't access mailbox
        # Both mean "wrong credential for this mailbox" - try next one from join table
        if e.message.include?("404") || e.message.include?("403")
          Rails.logger.debug "[SyncedEmail] #{e.message[0..3]} for email #{id} via cred #{attempt[:credential_id]} / #{attempt[:mailbox]} - trying next"
          next
        end
        raise
      end
    end

    return false unless attachment_metadata&.any?

    # Step 2: Filter to real attachments only (skip inline signature images)
    real_attachments = attachment_metadata.reject do |att|
      att["isInline"] && att["contentType"]&.start_with?("image/") && att["size"].to_i < 100_000
    end

    if real_attachments.empty?
      # Only inline images - mark email so we don't re-check
      Rails.logger.debug "[SyncedEmail] Email #{id} has only inline images (#{attachment_metadata.count} skipped)"
      update_column(:has_attachments, false)
      return true # Return true to prevent IMAP fallback
    end

    # Step 3: Record metadata for all real attachments (fast, no downloads)
    record_attachment_metadata!(real_attachments, used_mailbox)

    # Step 4: Download blobs for any attachments missing content
    Rails.logger.info "[SyncedEmail] Downloading pending blobs for email #{id} via Graph (#{used_mailbox})"
    download_pending_blobs!(used_client, used_attempt, used_mailbox)
    true
  end

  # Fetch attachments via IMAP (for non-M365 mailboxes: Gmail, Webcentral, etc.)
  # Uses SyncedEmailMailbox join table to find IMAP credential + UID.
  # Returns true if attachments were found and processed, false if no IMAP path worked.
  def sync_attachments_via_imap!
    imap_attempts = build_imap_credential_attempts
    return false if imap_attempts.empty?

    imap_attempts.each do |attempt|
      cred = ImapCredential.find_by(id: attempt[:imap_credential_id])
      next unless cred

      begin
        service = ImapEmailService.new(cred)
        mail_attachments = service.fetch_attachments_by_uid(attempt[:uid], folder: attempt[:folder])
        next unless mail_attachments&.any?

        Rails.logger.info "[SyncedEmail] Syncing #{mail_attachments.count} attachments for email #{id} via IMAP (#{attempt[:mailbox]})"
        store_imap_attachments!(mail_attachments, attempt[:mailbox])
        return true
      rescue => e
        Rails.logger.debug "[SyncedEmail] IMAP attachment fetch failed for email #{id} via cred #{attempt[:imap_credential_id]}: #{e.message}"
        next
      end
    end

    false
  end

  # Two-Step Attachment Sync (Feb 2026)
  # ════════════════════════════════════════════════════════════════════
  # Step 1: Record metadata for all real attachments WITHOUT downloading content.
  # This ensures every attachment is tracked locally (SSoT) even if the download fails.
  # Uses find_or_create! so re-running is idempotent.
  #
  # Step 2 (download_pending_blobs!) fetches actual bytes into StorageBlob.
  # If step 2 fails for an attachment, the metadata survives for retry.
  # ════════════════════════════════════════════════════════════════════

  # Step 1: Record metadata (fast, no downloads)
  def record_attachment_metadata!(real_attachments, used_mailbox)
    real_attachments.each do |att_meta|
      filename = att_meta["name"] || "attachment"
      graph_attachment_id = att_meta["id"]
      byte_size = att_meta["size"].to_i

      # Detect item attachments (nested emails) - MS Graph returns null contentType for these
      is_item_attachment = att_meta["@odata.type"] == "#microsoft.graph.itemAttachment"
      content_type = if is_item_attachment
                       "message/rfc822"
                     else
                       att_meta["contentType"]
                     end
      if is_item_attachment && !filename.downcase.end_with?(".eml")
        filename = "#{filename}.eml"
      end

      WarehouseDocumentCreator.find_or_create!(
        find_by: {
          source_type: "email_attachment",
          linkable: self,
          metadata_match: { "outlook_attachment_id" => graph_attachment_id }
        },
        filename: filename,
        source_type: "email_attachment",
        linkable: self,
        file_size: byte_size.positive? ? byte_size : nil,
        content_type: content_type,
        metadata: {
          "synced_email_id" => id.to_s,
          "outlook_attachment_id" => graph_attachment_id,
          "mailbox" => used_mailbox,
          "blob_status" => "pending"
        }.compact
      )
    rescue StandardError => e
      Rails.logger.error "[SyncedEmail] Failed to record metadata for attachment '#{filename}' on email #{id}: #{e.class}: #{e.message}"
      Rails.logger.error e.backtrace.first(3).join("\n")
      raise # Fail fast - don't silently skip attachments
    end

    # Update attachment count from local SSoT
    new_count = attachment_documents.reload.count
    update_column(:attachment_count, new_count)
  end

  # Step 2: Download blobs for attachments that don't have one yet.
  # Tries ALL pending blobs (don't stop at first failure).
  # Raises after attempting all if any failed - ensures visibility while
  # maximizing data recovery per run.
  def download_pending_blobs!(client, attempt, used_mailbox)
    blobless_docs = attachment_documents.reload.where(storage_blob_id: nil)
    return if blobless_docs.empty?

    Rails.logger.info "[SyncedEmail] Downloading #{blobless_docs.count} pending blobs for email #{id}"

    failed_docs = []

    blobless_docs.each do |doc|
      graph_attachment_id = doc.metadata&.dig("outlook_attachment_id")
      next unless graph_attachment_id.present?

      result = client.download_email_attachment(attempt[:mailbox], attempt[:outlook_id], graph_attachment_id)
      unless result
        doc.update!(metadata: (doc.metadata || {}).merge("blob_status" => "failed", "blob_error" => "Download returned nil"))
        failed_docs << { doc_id: doc.id, error: "Download returned nil" }
        next
      end

      blob = StorageBlob.find_or_create_for_content!(
        result[:content], filename: result[:filename], content_type: result[:content_type]
      )

      doc.update!(
        storage_blob: blob,
        file_size: blob.file_size,
        content_type: result[:content_type] || blob.content_type,
        metadata: (doc.metadata || {}).merge(
          "blob_status" => "downloaded",
          "content_id" => result[:content_id]
        ).compact
      )

      blob.increment!(:reference_count)
      Rails.logger.debug "[SyncedEmail] Downloaded blob for: #{doc.ui_name}"
    rescue StandardError => e
      Rails.logger.error "[SyncedEmail] Failed to download blob for doc #{doc.id} (#{doc.ui_name}): #{e.class}: #{e.message}"
      Rails.logger.error e.backtrace.first(3).join("\n")
      doc.update!(metadata: (doc.metadata || {}).merge("blob_status" => "failed", "blob_error" => e.message.truncate(200))) rescue nil
      failed_docs << { doc_id: doc.id, error: "#{e.class}: #{e.message.truncate(100)}" }
    end

    if failed_docs.any?
      raise "Failed to download #{failed_docs.count}/#{blobless_docs.count} blobs for email #{id}: #{failed_docs.map { |f| f[:error] }.first}"
    end
  end

  # Store attachments fetched from Microsoft Graph API (legacy bulk path)
  # Kept for backward compatibility - new code uses two-step: record_attachment_metadata! + download_pending_blobs!
  def store_graph_attachments!(attachments, used_mailbox)
    attachments.each do |att|
      next if att["contentBytes"].blank?

      content = Base64.decode64(att["contentBytes"])
      filename = att["name"]
      content_type = att["contentType"]
      byte_size = att["size"].to_i
      content_id = att["contentId"]
      graph_attachment_id = att["id"]

      # Skip small inline images (likely signatures)
      next if att["isInline"] && content_type&.start_with?("image/") && byte_size < 50_000

      # Per-attachment dedup: skip only if THIS attachment already has a blob
      existing_doc = attachment_documents.find { |d| d.original_filename == filename }
      next if existing_doc&.storage_blob_id.present?

      blob = StorageBlob.find_or_create_for_content!(
        content, filename: filename, content_type: content_type
      )

      WarehouseDocumentCreator.create!(
        filename: filename,
        source_type: "email_attachment",
        linkable: self,
        storage_blob: blob,
        file_size: byte_size.positive? ? byte_size : blob.file_size,
        content_type: content_type || blob.content_type,
        metadata: {
          "synced_email_id" => id.to_s,
          "content_id" => content_id,
          "outlook_attachment_id" => graph_attachment_id,
          "mailbox" => used_mailbox
        }.compact
      )

      blob.increment!(:reference_count)
      Rails.logger.debug "[SyncedEmail] Synced attachment: #{filename}"
    rescue StandardError => e
      Rails.logger.error "[SyncedEmail] Failed to sync attachment #{filename}: #{e.message}"
    end
  end

  # Store attachments fetched from IMAP
  def store_imap_attachments!(mail_attachments, mailbox)
    mail_attachments.each do |att|
      next unless att[:content].present?

      filename = att[:filename]
      content_type = att[:content_type]
      content = att[:content]
      byte_size = att[:size] || content.bytesize

      # Skip small inline images (likely signatures)
      next if content_type&.start_with?("image/") && byte_size < 50_000

      # Per-attachment dedup
      existing_doc = attachment_documents.find { |d| d.original_filename == filename }
      next if existing_doc&.storage_blob_id.present?

      blob = StorageBlob.find_or_create_for_content!(
        content, filename: filename, content_type: content_type
      )

      WarehouseDocumentCreator.create!(
        filename: filename,
        source_type: "email_attachment",
        linkable: self,
        storage_blob: blob,
        file_size: byte_size.positive? ? byte_size : blob.file_size,
        content_type: content_type || blob.content_type,
        metadata: {
          "synced_email_id" => id.to_s,
          "mailbox" => mailbox,
          "source" => "imap"
        }.compact
      )

      blob.increment!(:reference_count)
      Rails.logger.debug "[SyncedEmail] Synced IMAP attachment: #{filename}"
    rescue StandardError => e
      Rails.logger.error "[SyncedEmail] Failed to sync IMAP attachment #{filename}: #{e.message}"
    end
  end

  # Build ordered list of Microsoft Graph credential attempts.
  # Priority: 1) Legacy fields on SyncedEmail (fast path), 2) SyncedEmailMailbox appearances.
  # FRC (Feb 2026): Legacy fields are set by FIRST sync and never updated. For emails originally
  # synced via a credential that can no longer access the mailbox (e.g., different Azure AD tenant),
  # the join table may have an alternative appearance with a working credential.
  def build_graph_credential_attempts
    attempts = []

    # 1) Legacy fields (backward compat, fastest path for the 90% case)
    if microsoft_credential_id.present? && outlook_id.present? && mailbox_owner_email.present?
      attempts << { credential_id: microsoft_credential_id, mailbox: mailbox_owner_email, outlook_id: outlook_id }
    end

    # 2) All mailbox appearances with M365 credentials (the SSoT join table)
    mailbox_appearances.where.not(microsoft_credential_id: nil).where.not(outlook_id: [nil, ""]).each do |appearance|
      key = [appearance.microsoft_credential_id, appearance.outlook_id]
      next if attempts.any? { |a| [a[:credential_id], a[:outlook_id]] == key }
      attempts << {
        credential_id: appearance.microsoft_credential_id,
        mailbox: appearance.mailbox_owner_email,
        outlook_id: appearance.outlook_id
      }
    end

    attempts
  end

  # Build IMAP credential attempts for attachment fetching.
  # Priority: 1) Legacy fields on SyncedEmail (fast path), 2) SyncedEmailMailbox appearances.
  # Used as fallback when no Microsoft Graph credential is available (Gmail, Webcentral, etc.)
  def build_imap_credential_attempts
    attempts = []

    # 1) Legacy fields (backward compat, fastest path)
    if imap_credential_id.present? && uid.present? && mailbox_owner_email.present?
      attempts << {
        imap_credential_id: imap_credential_id,
        mailbox: mailbox_owner_email,
        uid: uid,
        folder: folder_name || "INBOX"
      }
    end

    # 2) All mailbox appearances with IMAP credentials (the SSoT join table)
    mailbox_appearances.where.not(imap_credential_id: nil).where.not(uid: nil).each do |appearance|
      key = [appearance.imap_credential_id, appearance.uid]
      next if attempts.any? { |a| [a[:imap_credential_id], a[:uid]] == key }
      attempts << {
        imap_credential_id: appearance.imap_credential_id,
        mailbox: appearance.mailbox_owner_email,
        uid: appearance.uid,
        folder: appearance.folder_name || "INBOX"
      }
    end

    attempts
  end

  # SSoT: Normalize all email addresses to lowercase before saving
  # This ensures case-insensitive matching works with simple equality checks
  # FRC: Fix at source (storage) not at query time (LOWER() in every query)
  def normalize_email_addresses
    self.from_email = from_email&.downcase
    self.to_emails = to_emails&.map(&:downcase) if to_emails.present?
    self.cc_emails = cc_emails&.map(&:downcase) if cc_emails.present?
  end

  # Phase 4: Determine if virtual folder needs updating
  # Returns true if received_at, mailbox_owner_email, or email_mailbox_id changed
  # NOTE (Feb 2026 FRC Fix): Removed should_update_virtual_folder? and update_warehouse_document_folder
  # Folder paths are now computed at runtime via WarehouseDocument#computed_folder_path
  # No sync needed - renaming a WarehouseFolder instantly affects all documents

  # Phase 4: Ensure warehouse_document exists when storage_path is set
  # This is a safety net - EmailStorageUploadService should create it, but if
  # storage_path is set via other means (migration, manual update), this ensures
  # the WarehouseDocument exists for virtual folder rendering.
  def ensure_warehouse_document
    return if warehouse_document.present?
    return unless storage_path.present?

    # Find or create StorageBlob for this path
    blob = StorageBlob.find_or_create_by!(storage_path: storage_path) do |b|
      b.content_hash = Digest::SHA256.hexdigest("#{id}-#{storage_path}")
      b.original_filename = "#{id}.eml"
      b.content_type = "message/rfc822"
      b.reference_count = 0
    end

    create_warehouse_document!(
      source_type: "email",
      ui_name: subject.presence || "No Subject",  # SSoT: display_name renamed to ui_name (Feb 2026)
      original_filename: "#{id}.eml",
      storage_blob: blob,
      metadata: {
        subject: subject,
        from_email: from_email,
        received_at: received_at&.iso8601,
        mailbox: mailbox_owner_email
      }
    )

    blob.increment!(:reference_count)
    Rails.logger.debug "[SyncedEmail] Created WarehouseDocument for email #{id} in folder: #{virtual_folder_path}"
  rescue ActiveRecord::RecordInvalid => e
    Rails.logger.error "[SyncedEmail] Failed to create WarehouseDocument: #{e.message}"
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
          Rails.logger.info "[SyncedEmail] Auto-assigned email #{id} to job #{job.id} via explicit ID in subject"
          return
        end
      end
    end

    # Find job from another email in the same thread
    thread_job_id = SyncedEmail
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

    Rails.logger.info "[SyncedEmail] Auto-assigned email #{id} to job #{thread_job_id} via thread inheritance"
  rescue StandardError => e
    Rails.logger.error "[SyncedEmail] Failed to inherit job from thread: #{e.message}"
  end

  # Auto-link to SM Task if another email in this conversation thread is already linked
  # Thread replies appear in the task's Emails section (not Response Files)
  # Only emails SENT from the task should have category: response
  def inherit_task_from_thread
    return if conversation_id.blank?  # No thread to inherit from

    # Find all task attachments for other emails in this thread
    thread_email_ids = SyncedEmail
      .where(conversation_id: conversation_id)
      .where.not(id: id)
      .pluck(:id)

    return if thread_email_ids.empty?

    # Find tasks that have any of these emails attached
    task_attachments = SmTaskAttachment
      .where(attachable_type: "SyncedEmail", attachable_id: thread_email_ids)
      .select(:sm_task_id, :added_by_id)
      .distinct

    return if task_attachments.empty?

    # Link this email to each task (avoid duplicates)
    task_attachments.each do |ta|
      # Skip if already linked to this task
      next if SmTaskAttachment.exists?(
        sm_task_id: ta.sm_task_id,
        attachable_type: "SyncedEmail",
        attachable_id: id
      )

      SmTaskAttachment.create!(
        sm_task_id: ta.sm_task_id,
        attachable: self,
        attachment_type: "email",
        category: "info",  # Incoming emails are always info, not response
        added_by_id: ta.added_by_id
      )

      Rails.logger.info "[SyncedEmail] Auto-linked email #{id} to task #{ta.sm_task_id} via thread inheritance"
    end
  rescue StandardError => e
    Rails.logger.error "[SyncedEmail] Failed to inherit task from thread: #{e.message}"
  end

  # Broadcast email deletion to the owner via ActionCable
  def broadcast_email_deleted
    return unless ssot_owner_id.present?

    EmailChannel.broadcast_email_deleted(ssot_owner, id)
  rescue StandardError => e
    Rails.logger.error "Failed to broadcast email deletion: #{e.message}"
  end
end
