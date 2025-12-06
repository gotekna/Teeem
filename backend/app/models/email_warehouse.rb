class EmailWarehouse < ApplicationRecord
  self.table_name = "email_warehouse"

  # ActiveStorage attachments
  has_many_attached :files

  # Associations
  belongs_to :job, optional: true
  belongs_to :synced_by_user, class_name: "User", optional: true

  # Validations
  validates :internet_message_id, presence: true, uniqueness: true

  # Scopes
  scope :unassigned, -> { where(job_id: nil) }
  scope :assigned, -> { where.not(job_id: nil) }
  scope :latest_in_thread, -> { where(is_latest_in_thread: true) }
  scope :by_conversation, ->(conv_id) { where(conversation_id: conv_id).order(received_at: :asc) }
  scope :recent_first, -> { order(received_at: :desc) }
  scope :for_job, ->(job_id) { where(job_id: job_id) }
  scope :received_after, ->(date) { where("received_at >= ?", date) }
  scope :received_before, ->(date) { where("received_at <= ?", date) }

  # Full-text search scope
  scope :search_text, ->(query) {
    where("searchable @@ plainto_tsquery('english', ?)", query)
  }

  # Search by email address (from, to, or cc)
  # Can accept a single email string or an array of emails
  # Case-insensitive comparison using LOWER()
  scope :involving_email, ->(emails) {
    emails = Array(emails).compact
    return none if emails.empty?

    conditions = emails.map do |email|
      email_lower = email.downcase
      sanitize_sql_array([
        "LOWER(from_email) = ? OR ? = ANY(SELECT LOWER(unnest(to_emails))) OR ? = ANY(SELECT LOWER(unnest(cc_emails)))",
        email_lower, email_lower, email_lower
      ])
    end
    where(conditions.join(" OR "))
  }

  # Callbacks
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

  # Job ID patterns to look for in subject line
  # Matches: id:20, id.20, id;20, #20, job:20, job.20, job;20, [20], (20)
  JOB_ID_PATTERN = /(?:id|job)[:.\-;]\s*(\d+)|#(\d+)|\[(\d+)\]|\(job\s*(\d+)\)/i

  # Check if this email matches any job based on various criteria
  def find_matching_jobs
    matches = []

    # Skip matching if email is classified as irrelevant (marketing, spam, transactional)
    return matches if classified_as_irrelevant?

    # HIGHEST PRIORITY: Match by explicit job ID in subject
    # Patterns: id:20, id.20, id;20, #20, job:20, [20], etc.
    if subject.present?
      subject.scan(JOB_ID_PATTERN).each do |match_groups|
        job_id = match_groups.compact.first&.to_i
        next unless job_id&.positive?

        job = Job.find_by(id: job_id)
        if job
          matches << {
            job: job,
            match_type: "explicit_job_id",
            confidence: 1.0,
            reason: "Explicit job ID #{job_id} found in subject"
          }
        end
      end
    end

    # Match by email addresses (contacts linked to jobs)
    all_emails = [ from_email, *to_emails, *cc_emails ].compact.uniq

    all_emails.each do |email_addr|
      # Find contacts with this email
      contacts = Contact.where(email: email_addr)
      contacts.each do |contact|
        contact.jobs.each do |job|
          # Only match if email has job-specific context (stricter filtering)
          next unless email_mentions_job_context?(job)

          matches << {
            job: job,
            match_type: "contact_email_with_context",
            confidence: 0.75,  # Lowered from 0.9 to reduce false positives
            reason: "Email #{email_addr} is linked to job contact and mentions job context"
          }
        end
      end
    end

    # Match by job title/address in subject or body
    Job.find_each do |job|
      next if job.title.blank?

      # Check if job address appears in subject
      if subject&.downcase&.include?(job.title.downcase)
        matches << {
          job: job,
          match_type: "address_in_subject",
          confidence: 0.85,
          reason: "Job address '#{job.title}' found in subject"
        }
      end

      # Check if street name appears in subject
      street_match = job.title.match(/\d+\s+(.+?)\s+(Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Court|Ct|Place|Pl)/i)
      if street_match
        street_name = street_match[1].downcase
        if subject&.downcase&.include?(street_name)
          matches << {
            job: job,
            match_type: "street_in_subject",
            confidence: 0.7,
            reason: "Street name '#{street_name}' found in subject"
          }
        end
      end
    end

    # Deduplicate and sort by confidence
    matches
      .uniq { |m| m[:job].id }
      .sort_by { |m| -m[:confidence] }
  end

  # Check if email mentions job-specific context (used for filtering false positives)
  def email_mentions_job_context?(job)
    return false if job.nil?

    # Check subject for job ID
    return true if subject&.include?(job.id.to_s)

    # Check subject for job title/address
    return true if job.title.present? && subject&.downcase&.include?(job.title.downcase)

    # Check for street name match
    if job.title.present?
      street_match = job.title.match(/\d+\s+(.+?)\s+(Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Court|Ct|Place|Pl)/i)
      if street_match
        street_name = street_match[1].downcase
        return true if subject&.downcase&.include?(street_name)
      end
    end

    # No job-specific context found
    false
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

  # Extract text from all attached PDF files
  def extract_pdf_text
    return nil unless files.attached?

    pdf_texts = []

    files.each do |file|
      next unless file.content_type == "application/pdf"

      begin
        file.open do |temp_file|
          reader = PDF::Reader.new(temp_file.path)
          text = reader.pages.map(&:text).join("\n")
          pdf_texts << {
            filename: file.filename.to_s,
            text: text,
            pages: reader.page_count
          }
        end
      rescue StandardError => e
        Rails.logger.error "Failed to extract PDF text from #{file.filename}: #{e.message}"
      end
    end

    pdf_texts.presence
  end

  # Sync PDF attachments from Outlook
  def sync_attachments_from_outlook(outlook_service)
    return unless outlook_id.present? && has_attachments

    # Skip if attachments already synced
    return if files.attached?

    begin
      attachments = outlook_service.get_attachments(outlook_id)

      attachments.each do |attachment|
        # Only download PDF files
        next unless attachment["contentType"] == "application/pdf"

        file_data = outlook_service.download_attachment(outlook_id, attachment["id"])
        next unless file_data

        # Attach to EmailWarehouse using ActiveStorage
        files.attach(
          io: StringIO.new(file_data[:content]),
          filename: file_data[:filename],
          content_type: file_data[:content_type]
        )

        Rails.logger.info "Attached PDF #{file_data[:filename]} to email #{id}"
      end
    rescue StandardError => e
      Rails.logger.error "Failed to sync attachments for email #{id}: #{e.message}"
    end
  end

  private

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
end
