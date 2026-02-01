# frozen_string_literal: true

# EmailToTaskService - Creates tasks from emails sent to newtask@ mailbox
#
# Unlike EmailToJobService (AI extraction + proposals), this is simple/direct:
# - Email subject → task name
# - Email body → task description
# - Sender → assigned user (if internal) + task contact
# - CC recipients → auto-followers
# - Attaches source email and related emails
#
# SSoT: Mailbox address configured in TenantSetting.monitored_mailbox_newtask
#
class EmailToTaskService
  class TaskCreationError < StandardError; end

  def initialize(synced_email, user: nil)
    @email = synced_email
    @user = user || synced_email.synced_by_user || User.first
  end

  # Main entry point - creates task directly from email
  # FRC (Jan 2026): Added duplicate prevention - returns existing task if email already has one
  def create_task
    # Check for existing task created from this email (prevents duplicate clicks)
    existing_task = find_existing_task_for_email
    if existing_task
      Rails.logger.info "[EmailToTaskService] Task already exists for email #{@email.id}: Task ##{existing_task.id}"
      return existing_task
    end

    ActiveRecord::Base.transaction do
      # 1. Create the task
      task = build_task
      task.save!

      Rails.logger.info "[EmailToTaskService] Created task ##{task.id}: #{task.name}"

      # 2. Map sender to user/contact and add as task contact
      add_sender_to_task(task)

      # 3. Auto-assign if sender maps to internal user
      auto_assign_if_internal_user(task)

      # 4. Add CC recipients as followers (if they're internal users)
      add_cc_as_followers(task)

      # 5. Attach the source email
      attach_source_email(task)

      # 6. Extract auto-match keywords from email subject
      # This enables automatic matching of future related emails
      extract_auto_match_keywords(task)

      # 7. Auto-attach related emails from same conversation
      # FRC (Jan 2026): Re-enabled per user request - attach conversation emails on creation,
      # user can remove unwanted ones. Additional emails shown as suggestions in UI.
      find_and_attach_related_emails(task)

      # 8. Add email participants as task contacts
      add_email_participants_as_contacts(task)

      # 9. Log activity
      log_task_created(task)

      task
    end
  rescue StandardError => e
    Rails.logger.error "[EmailToTaskService] Failed to create task: #{e.message}"
    Rails.logger.error e.backtrace.first(10).join("\n")
    raise TaskCreationError, e.message
  end

  private

  def build_task
    SmTask.new(
      name: sanitize_task_name(@email.subject),
      description: build_description,
      status: "not_started",
      start_date: Date.current,
      end_date: Date.current + 1.day,
      duration_days: 1,
      task_number: generate_task_number,
      sequence_order: 1,
      created_by: @user,
      assigned_user: @user,  # Auto-assign to the user creating the task
      is_private: false,
      # SSoT: Multi-tenancy - set tenant_id from user (background job has no tenant context)
      tenant_id: @user&.tenant_id
    )
  end

  def sanitize_task_name(subject)
    return "Task from email" if subject.blank?

    # Remove common prefixes (RE:, FW:, etc.)
    name = subject.gsub(/^(RE:|FW:|FWD:)\s*/i, "").strip

    # Truncate if too long
    name.truncate(255)
  end

  def build_description
    parts = []

    # Add email metadata
    parts << "**Created from email:**"
    parts << "From: #{@email.from_name || @email.from_email}"
    parts << "Date: #{@email.received_at&.strftime('%d/%m/%Y %H:%M')}"
    parts << ""

    # Add email body (always strip HTML - body_text may contain HTML from Graph API)
    raw_body = @email.body_text.presence || @email.body_html
    body = strip_html(raw_body) if raw_body.present?
    parts << body.truncate(5000) if body.present?

    parts.join("\n")
  end

  def generate_task_number
    # Standalone tasks (no job) use incrementing number starting from 10000
    # to avoid conflicts with job task numbers
    max_standalone = SmTask.where(job_id: nil).maximum(:task_number) || 9999
    max_standalone + 1
  end

  def add_sender_to_task(task)
    return if @email.from_email.blank?

    # Try to find internal user first
    user = User.find_by("LOWER(email) = ?", @email.from_email.downcase)

    if user
      task.add_contact(user, role: "sender", is_sender: true)
      Rails.logger.info "[EmailToTaskService] Added sender as user: #{user.name}"
    else
      # Try to find or create contact
      contact = find_or_create_contact(@email.from_email, @email.from_name)
      if contact
        task.add_contact(contact, role: "sender", is_sender: true)
        Rails.logger.info "[EmailToTaskService] Added sender as contact: #{contact.display_name}"
      end
    end
  end

  def auto_assign_if_internal_user(task)
    return if @email.from_email.blank?

    user = User.find_by("LOWER(email) = ?", @email.from_email.downcase)

    if user
      task.update!(assigned_user_id: user.id)
      Rails.logger.info "[EmailToTaskService] Auto-assigned task to #{user.name} (sender)"
    end
  end

  def add_cc_as_followers(task)
    return if @email.cc_emails.blank?

    @email.cc_emails.each do |cc_email|
      next if cc_email.blank?

      user = User.find_by("LOWER(email) = ?", cc_email.downcase)

      if user
        # Use TaskFollower for internal users (for notifications)
        task.follow_by(user)
        # Also add as task contact
        task.add_contact(user, role: "cc")
        Rails.logger.info "[EmailToTaskService] Added CC user as follower: #{user.name}"
      else
        # Add as external contact
        contact = find_or_create_contact(cc_email)
        task.add_contact(contact, role: "cc") if contact
      end
    end
  end

  def attach_source_email(task)
    task.sm_task_attachments.create!(
      attachable: @email,
      attachment_type: "email",
      is_source: true,  # SSoT: Marks this as the source email (task created from)
      notes: "Source email - task created from this email",
      added_by: @user
    )
    Rails.logger.info "[EmailToTaskService] Attached source email ##{@email.id}"
  end

  def extract_auto_match_keywords(task)
    return if @email.subject.blank?

    # Extract reference numbers and identifiers from the email subject
    # These will be used to auto-match future emails to this task
    keywords = []

    subject = @email.subject

    # 1. Extract alphanumeric codes (like KAMN49DQUCVA, REF123456)
    # Pattern: 3+ consecutive letters followed by 2+ numbers, or vice versa
    alphanumeric_codes = subject.scan(/\b[A-Z]{2,}[0-9]{2,}[A-Z0-9]*\b/i)
    keywords.concat(alphanumeric_codes.map(&:upcase))

    # 2. Extract pure numeric reference numbers (6+ digits)
    # Often order numbers, ticket numbers, etc.
    numeric_refs = subject.scan(/\b\d{6,}\b/)
    keywords.concat(numeric_refs)

    # 3. Extract bracketed references [REF-123] or (REF123)
    bracketed = subject.scan(/[\[\(]([^\]\)]+)[\]\)]/).flatten
    keywords.concat(bracketed.select { |b| b.match?(/\d/) && b.length >= 4 })

    # 4. Extract common reference patterns: REF-xxx, ORDER-xxx, TICKET-xxx, etc.
    reference_patterns = subject.scan(/\b(?:REF|ORDER|TICKET|CASE|ID|PO|INV)[-:#]?\s*([A-Z0-9-]+)\b/i).flatten
    keywords.concat(reference_patterns.map(&:upcase))

    # Clean up and dedupe
    keywords = keywords.map(&:strip).reject(&:blank?).uniq

    if keywords.any?
      task.update_column(:email_keywords, keywords.join(", "))
      Rails.logger.info "[EmailToTaskService] Extracted auto-match keywords: #{keywords.join(', ')}"
    end
  end

  def find_and_attach_related_emails(task)
    related = find_related_emails
    attached_count = 0

    related.each do |email|
      next if email.id == @email.id # Skip source email

      task.sm_task_attachments.create!(
        attachable: email,
        attachment_type: "email",
        notes: "Related email (same conversation/sender)",
        added_by: @user
      )
      attached_count += 1
    end

    Rails.logger.info "[EmailToTaskService] Attached #{attached_count} related emails" if attached_count > 0
  end

  def find_related_emails
    emails = []

    # 1. Same conversation thread (email chain history)
    if @email.conversation_id.present?
      emails += SyncedEmail
        .where(conversation_id: @email.conversation_id)
        .where.not(id: @email.id)
        .order(received_at: :desc)
        .limit(10)
        .to_a
    end

    # 2. Similar subject line (catches broken threads and forwards)
    # FRC: Extended to 90 days because forwards create new conversation IDs,
    # so subject matching is the only way to link back to original emails.
    base_subject = normalize_subject(@email.subject)
    if base_subject.present? && emails.size < 10
      subject_emails = SyncedEmail
        .where("subject ILIKE ?", "%#{base_subject}%")
        .where("received_at > ?", 90.days.ago)
        .where.not(id: [@email.id] + emails.map(&:id))
        .order(received_at: :desc)
        .limit(10 - emails.size)
        .to_a

      emails += subject_emails
    end

    # 3. Emails with same external party (not internal domains)
    # SSoT: Internal domains checked via TenantSetting.internal_domain_patterns
    # FRC: Extended to 90 days to match subject matching window
    external_email = find_external_party
    if external_email.present? && emails.size < 10
      party_emails = SyncedEmail
        .involving_email(external_email)
        .where("received_at > ?", 90.days.ago)
        .where.not(id: [@email.id] + emails.map(&:id))
        .order(received_at: :desc)
        .limit(10 - emails.size)
        .to_a

      emails += party_emails
    end

    # Return unique, limited list
    emails.uniq(&:id).first(10)
  end

  def normalize_subject(subject)
    return nil if subject.blank?

    # Strip RE:/FW:/FWD: prefixes and common tags like [SEC=OFFICIAL]
    subject
      .gsub(/^(RE:|FW:|FWD:)\s*/i, "")
      .gsub(/\[SEC=[^\]]+\]/i, "")
      .gsub(/\s+/, " ")
      .strip
      .first(50)  # Use first 50 chars for matching
  end

  def find_external_party
    # Find the first non-internal email address involved
    # SSoT: Get internal domains from TenantSetting
    internal_domain_patterns = TenantSetting.internal_domain_patterns
    newtask_address = TenantSetting.monitored_mailbox_newtask.downcase

    # Check from
    if @email.from_email.present?
      return @email.from_email unless internal_domain_patterns.any? { |d| @email.from_email.downcase.include?(d) }
    end

    # Check to recipients
    @email.to_emails&.each do |email_addr|
      next if email_addr.blank?
      next if email_addr.downcase == newtask_address
      next if internal_domain_patterns.any? { |d| email_addr.downcase.include?(d) }
      return email_addr
    end

    # Check cc recipients
    @email.cc_emails&.each do |email_addr|
      next if email_addr.blank?
      next if internal_domain_patterns.any? { |d| email_addr.downcase.include?(d) }
      return email_addr
    end

    nil
  end

  def add_email_participants_as_contacts(task)
    # To recipients (not already added as sender)
    @email.to_emails&.each do |email_addr|
      next if email_addr.blank?
      next if email_addr.downcase == @email.from_email&.downcase
      # SSoT: Use TenantSetting for monitored mailbox
      next if email_addr.downcase == TenantSetting.monitored_mailbox_newtask.downcase

      add_participant(task, email_addr, "participant")
    end
  end

  def add_participant(task, email_addr, role)
    return if email_addr.blank?

    # Check if already added (SSoT: contact emails are in contact_emails table)
    existing = task.task_contacts.joins(:user).where("LOWER(users.email) = ?", email_addr.downcase).exists? ||
               task.task_contacts.joins(contact: :contact_emails).where("LOWER(contact_emails.email) = ?", email_addr.downcase).exists?
    return if existing

    user = User.find_by("LOWER(email) = ?", email_addr.downcase)

    if user
      task.add_contact(user, role: role)
    else
      contact = find_or_create_contact(email_addr)
      task.add_contact(contact, role: role) if contact
    end
  end

  def find_or_create_contact(email, name = nil)
    return nil if email.blank?

    # Try to find existing (SSoT: Contact.find_by_email uses contact_emails table)
    contact = Contact.find_by_email(email)
    return contact if contact

    # Create new contact with email via contact_emails association
    # SSoT: Multi-tenancy - set tenant_id from user (background job has no tenant context)
    contact = Contact.create!(
      display_name: name || extract_name_from_email(email),
      entity_type: "person",
      tenant_id: @user&.tenant_id
    )
    contact.contact_emails.create!(email: email, is_primary: true)
    contact
  rescue ActiveRecord::RecordInvalid => e
    Rails.logger.warn "[EmailToTaskService] Failed to create contact for #{email}: #{e.message}"
    nil
  end

  def extract_name_from_email(email)
    local_part = email.split("@").first
    local_part.split(/[._-]/).map(&:capitalize).join(" ")
  end

  def strip_html(html)
    return nil if html.blank?
    html.gsub(/<[^>]*>/, " ").gsub(/&nbsp;/, " ").gsub(/&[a-z]+;/i, " ").gsub(/\s+/, " ").strip
  end

  def log_task_created(task)
    TaskActivityLog.create!(
      sm_task: task,
      user: @user,
      activity_type: "created",
      description: "Task created from email: #{@email.subject}"
    )
  rescue StandardError => e
    Rails.logger.warn "[EmailToTaskService] Failed to log activity: #{e.message}"
  end

  # FRC (Jan 2026): Find existing task created from this email
  # Multiple checks to prevent duplicates from rapid clicks or page refreshes:
  # 1. Check SmTaskAttachment with is_source: true (canonical method)
  # 2. Check SmTaskAttachment with same email (any attachment)
  # 3. Check for task with matching name created in last 5 minutes (fallback)
  def find_existing_task_for_email
    # Method 1: Check for source attachment (canonical)
    source_attachment = SmTaskAttachment.find_by(
      attachable: @email,
      is_source: true
    )
    return source_attachment.sm_task if source_attachment

    # Method 2: Check for any attachment linking this email to a task
    any_attachment = SmTaskAttachment.find_by(attachable: @email)
    return any_attachment.sm_task if any_attachment

    # Method 3: Check for task with same name created recently (race condition guard)
    # This catches rapid clicks before the first transaction commits
    expected_name = sanitize_task_name(@email.subject)
    recent_task = SmTask
      .where(name: expected_name)
      .where("created_at > ?", 5.minutes.ago)
      .order(created_at: :desc)
      .first
    return recent_task if recent_task

    nil
  end
end
