# Renamed from EmailWarehouse (Jan 2026)
# Part of the "Warehouse" table rename initiative - these are synced email records
# from Microsoft 365/IMAP, not part of the File Warehouse system.
class SyncedEmail < ApplicationRecord
  # Keep table name explicit during transition (after migration, this can be removed)
  self.table_name = "synced_emails"

  # Multi-tenancy: Scope all queries to current tenant (Tenant model is SSoT)
  acts_as_tenant :tenant

  include Searchable

  # Searchable columns for full-text search (GIN index)
  # Note: Uses custom update_searchable_vector callback instead of trigger
  searchable_columns :subject, :from_email, :body_text

  # SSoT: Email attachments use WarehouseDocument with source_type='email_attachment' (Jan 2026)
  # ActiveStorage has_many_attached :files was REMOVED - it violated SSoT.
  # EmailAttachment table was DROPPED - all attachments now in WarehouseDocument (Ultra Design).
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
  def ensure_mailbox_appearance(mailbox_email:, outlook_id: nil, uid: nil, folder_name: nil, is_read: false, microsoft_credential_id: nil, imap_credential_id: nil)
    appearance = mailbox_appearances.find_or_initialize_by(
      mailbox_owner_email: mailbox_email.downcase
    )
    appearance.assign_attributes(
      outlook_id: outlook_id,
      uid: uid,
      folder_name: folder_name,
      is_read: is_read,
      microsoft_credential_id: microsoft_credential_id,
      imap_credential_id: imap_credential_id
    )
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
  # FRC (Feb 2026): Fixed query to match actual storage format from sync_attachments!
  # Attachments are stored with source_type='email_attachment' and metadata key 'synced_email_id'
  def attachment_documents
    WarehouseDocument.where(source_type: 'email_attachment')
                     .where("metadata->>'synced_email_id' = ?", id.to_s)
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
  # - Setting WarehouseDocument.folder for database-driven folder rendering
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
  # SSoT: Uses PdfTextExtractionService for all PDF text extraction
  # Note: Uses WarehouseDocument (Jan 2026 - email_attachments table dropped)
  def extract_pdf_text
    return nil unless attachment_documents.any?

    pdf_texts = []

    attachment_documents.each do |doc|
      content_type = doc.content_type || doc.storage_blob&.content_type
      next unless content_type == "application/pdf"
      next unless doc.storage_blob.present?

      begin
        content = doc.storage_blob.download
        next unless content.present?

        result = PdfTextExtractionService.extract(content, join_pages: true)
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
  def link_existing_attachments!
    return false unless has_attachments
    return false if attachment_documents.any?

    # Find related emails with synced attachments (via WarehouseDocument)
    related_with_attachments = SyncedEmail.where.not(id: id)
      .where(has_attachments: true)
      .joins("INNER JOIN warehouse_documents ON warehouse_documents.metadata->>'synced_email_id' = synced_emails.id::text")
      .where(warehouse_documents: { source_type: 'email_attachment' })
      .where.not(warehouse_documents: { storage_blob_id: nil })

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
  def copy_attachments_from!(source_email)
    source_email.attachment_documents.each do |src_doc|
      next unless src_doc.storage_blob_id

      # Create new WarehouseDocument linking to same blob
      WarehouseDocument.create!(
        documentable: self,
        storage_blob_id: src_doc.storage_blob_id,
        ui_name: src_doc.ui_name,
        original_filename: src_doc.original_filename,
        source_type: 'email_attachment',
        tenant_id: tenant_id,
        content_type: src_doc.content_type,
        file_size: src_doc.file_size,
        metadata: { 'synced_email_id' => id.to_s }
      )

      # Increment blob reference count
      src_doc.storage_blob&.increment!(:reference_count)
      Rails.logger.debug "[SyncedEmail] Linked attachment: #{src_doc.ui_name} → blob #{src_doc.storage_blob_id}"
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
  def sync_attachments!(force: false)
    has_inline_images = body_html&.include?('cid:')
    return unless has_attachments || has_inline_images
    # FRC (Jan 2026): Only skip if ALL attachments have blobs
    existing_docs = attachment_documents.where.not(storage_blob_id: nil)
    return if !force && existing_docs.any?

    # SSoT: Try linking existing attachments first (don't re-download)
    return if link_existing_attachments!

    unless microsoft_credential_id.present? && outlook_id.present? && mailbox_owner_email.present?
      Rails.logger.warn "[SyncedEmail] Cannot sync attachments for #{id} - missing credential/outlook_id/mailbox"
      return
    end

    cred = MicrosoftCredential.find_by(id: microsoft_credential_id)
    return unless cred

    client = MicrosoftAppGraphClient.new(cred)
    attachments = client.get_email_attachments(mailbox_owner_email, outlook_id)

    Rails.logger.info "[SyncedEmail] Syncing #{attachments.count} attachments for email #{id}"

    attachments.each do |att|
      next if att["contentBytes"].blank?

      content = Base64.decode64(att["contentBytes"])
      filename = att["name"]
      content_type = att["contentType"]
      byte_size = att["size"].to_i
      content_id = att["contentId"]  # For matching cid: references in HTML

      # Skip small inline images (likely signatures)
      next if att["isInline"] && content_type&.start_with?("image/") && byte_size < 50_000

      # Check if already have this attachment (by filename)
      existing_doc = attachment_documents.find { |d| d.original_filename == filename }
      next if existing_doc&.storage_blob_id.present?

      # Create StorageBlob (handles deduplication via content_hash)
      blob = StorageBlob.find_or_create_for_content!(
        content,
        filename: filename,
        content_type: content_type
      )

      # Create WarehouseDocument linking to blob
      WarehouseDocument.create!(
        documentable: self,
        storage_blob_id: blob.id,
        ui_name: filename,  # SSoT: display_name renamed to ui_name (Feb 2026)
        original_filename: filename,
        source_type: 'email_attachment',
        tenant_id: tenant_id,
        content_type: content_type || blob.content_type,
        file_size: byte_size.positive? ? byte_size : blob.file_size,
        metadata: { 'synced_email_id' => id.to_s, 'content_id' => content_id }.compact
      )

      blob.increment!(:reference_count)
      Rails.logger.debug "[SyncedEmail] Synced attachment: #{filename}"
    rescue StandardError => e
      Rails.logger.error "[SyncedEmail] Failed to sync attachment #{filename}: #{e.message}"
    end

    # Update attachment count
    update_column(:attachment_count, attachment_documents.reload.count)
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
