# frozen_string_literal: true

# EmailToTaskService - Creates tasks from emails sent to newtask@tekna.com.au
#
# Unlike EmailToJobService (AI extraction + proposals), this is simple/direct:
# - Email subject → task name
# - Email body → task description
# - Sender → assigned user (if internal) + task contact
# - CC recipients → auto-followers
# - Attaches source email and related emails
#
class EmailToTaskService
  class TaskCreationError < StandardError; end

  NEW_TASK_EMAIL_ADDRESS = "newtask@tekna.com.au"

  def initialize(email_warehouse, user: nil)
    @email = email_warehouse
    @user = user || email_warehouse.synced_by_user || User.first
  end

  # Main entry point - creates task directly from email
  def create_task
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

      # 6. Find and attach related emails
      find_and_attach_related_emails(task)

      # 7. Add email participants as task contacts
      add_email_participants_as_contacts(task)

      # 8. Log activity
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
      is_private: false
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

    # Add email body
    body = @email.body_text.presence || strip_html(@email.body_html)
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
      notes: "Source email - task created from this email",
      added_by: @user
    )
    Rails.logger.info "[EmailToTaskService] Attached source email ##{@email.id}"
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

    # 1. Same conversation (thread)
    if @email.conversation_id.present?
      emails += EmailWarehouse
        .where(conversation_id: @email.conversation_id)
        .where.not(id: @email.id)
        .order(received_at: :desc)
        .limit(10)
        .to_a
    end

    # 2. Recent emails involving same sender (last 7 days)
    if @email.from_email.present? && emails.size < 10
      sender_emails = EmailWarehouse
        .involving_email(@email.from_email)
        .where("received_at > ?", 7.days.ago)
        .where.not(id: [@email.id] + emails.map(&:id))
        .order(received_at: :desc)
        .limit(10 - emails.size)
        .to_a

      emails += sender_emails
    end

    # Return unique, limited list
    emails.uniq(&:id).first(10)
  end

  def add_email_participants_as_contacts(task)
    # To recipients (not already added as sender)
    @email.to_emails&.each do |email_addr|
      next if email_addr.blank?
      next if email_addr.downcase == @email.from_email&.downcase
      next if email_addr.downcase == NEW_TASK_EMAIL_ADDRESS.downcase

      add_participant(task, email_addr, "participant")
    end
  end

  def add_participant(task, email_addr, role)
    return if email_addr.blank?

    # Check if already added
    existing = task.task_contacts.joins(:user).where("LOWER(users.email) = ?", email_addr.downcase).exists? ||
               task.task_contacts.joins(:contact).where("LOWER(contacts.email) = ?", email_addr.downcase).exists?
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

    # Try to find existing
    contact = Contact.find_by("LOWER(email) = ?", email.downcase)
    return contact if contact

    # Create new contact
    Contact.create!(
      email: email,
      display_name: name || extract_name_from_email(email),
      entity_type: "person"
    )
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
end
