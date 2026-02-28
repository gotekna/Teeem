# frozen_string_literal: true

# ProcessNewEntityEmailsJob - Process emails to newjob@/newtask@/newcase@ mailboxes
#
# FRC (Feb 2026): Merged ProcessNewJobEmailsJob + ProcessNewTaskEmailsJob + ProcessNewCaseEmailsJob.
# All three follow the same pattern: find emails to a monitored mailbox, create proposals/tasks.
# Running them separately tripled scheduling overhead for identical patterns.
#
# Also fixes:
# - ProcessNewCaseEmailsJob was orphaned (never in recurring.yml) — now included
# - All three were on :low/:default (shared worker) — moved to :email_enrichment (email worker)
#   because processing emails to create entities IS email work
#
# FRC (Feb 2026): Moved BACK to :critical queue. On :email_enrichment, this job NEVER ran —
# the single-threaded email worker was monopolized by AllOrgsEmailSyncJob, causing a 2,132-job
# backlog. This is SALES — leads must process immediately. The job is lightweight (reads
# SyncedEmail + calls AI service), doesn't need heavy email worker resources.
#
# Also widened time window from 1 hour → 7 days. With 1 hour, any processing delay
# permanently lost the email. The .where.not(id: Proposal.select(:fk)) already prevents
# re-processing, so the wider window is safe.
#
# Runs every 5 minutes via recurring.yml on :critical queue.
#
class ProcessNewEntityEmailsJob < ApplicationJob
  include DeduplicatableJob
  queue_as :critical

  MAX_RUNTIME = 3.minutes

  # Legacy folder name for new job emails (kept for backwards compatibility)
  NEW_JOB_FOLDER_NAME = "A - New Job".freeze

  ENTITY_CONFIGS = {
    job: {
      mailbox_setting: :monitored_mailbox_newjob,
      service_class: "EmailToJobService",
      service_method: :create_job_proposal,
      proposal_model: "EmailJobProposal",
      proposal_fk: :email_warehouse_id,
      extra_query: ->(address) {
        SyncedEmail
          .where("? = ANY(to_emails) OR LOWER(folder_name) = LOWER(?)", address, NEW_JOB_FOLDER_NAME)
          .where.not(id: EmailJobProposal.select(:email_warehouse_id))
          .where("created_at > ?", 7.days.ago)
          .order(received_at: :desc)
      },
      error_classes: ["EmailToJobService::RateLimitError"]
    },
    task: {
      mailbox_setting: :monitored_mailbox_newtask,
      service_class: "EmailToTaskService",
      service_method: :create_task,
      extra_query: ->(address) {
        processed_ids = SmTaskAttachment
          .where(attachable_type: "SyncedEmail")
          .where("notes LIKE ?", "Source email%")
          .pluck(:attachable_id)

        SyncedEmail
          .where("? = ANY(to_emails)", address)
          .where.not(id: processed_ids)
          .where("received_at > ?", EmailConstants::RECENT_EMAIL_WINDOW.ago)
          .order(received_at: :desc)
      },
      error_classes: ["EmailToTaskService::TaskCreationError"]
    },
    case: {
      mailbox_setting: :monitored_mailbox_newcase,
      service_class: "EmailToCaseService",
      service_method: :create_case_proposal,
      extra_query: ->(address) {
        SyncedEmail
          .where("? = ANY(to_emails)", address)
          .where.not(id: EmailCaseProposal.select(:email_warehouse_id))
          .where("created_at > ?", 7.days.ago)
          .order(received_at: :desc)
      },
      error_classes: ["EmailToCaseService::RateLimitError"]
    }
  }.freeze

  def perform
    @started_at = Time.current

    ENTITY_CONFIGS.each do |entity_type, config|
      break unless time_remaining?
      process_entity_type(entity_type, config)
    end
  end

  private

  def time_remaining?
    (Time.current - @started_at) < MAX_RUNTIME
  end

  def process_entity_type(entity_type, config)
    # ⚠️ FRC (Feb 2026): Must iterate over tenants.
    # SyncedEmail has acts_as_tenant. Without tenant context,
    # TenantSetting returns nil and SyncedEmail queries return nothing.
    Tenant.find_each do |tenant|
      break unless time_remaining?

      ActsAsTenant.with_tenant(tenant) do
        process_tenant_entity_emails(entity_type, config)
      end
    end
  end

  def process_tenant_entity_emails(entity_type, config)
    address = TenantSetting.send(config[:mailbox_setting])
    return if address.blank?

    emails = config[:extra_query].call(address)
    return if emails.empty?

    Rails.logger.info "[ProcessNewEntityEmails] Found #{emails.count} #{entity_type} emails for #{ActsAsTenant.current_tenant.name}"

    emails.each do |email|
      break unless time_remaining?
      process_single_email(email, entity_type, config)
    end
  end

  def process_single_email(email, entity_type, config)
    user = email.synced_by_user || User.first

    unless user
      Rails.logger.error "[ProcessNewEntityEmails] No user found for #{entity_type} email #{email.id}"
      return
    end

    service_class = config[:service_class].constantize
    service = service_class.new(email, user: user)
    result = service.send(config[:service_method])

    Rails.logger.info "[ProcessNewEntityEmails] Created #{entity_type} #{result.id} from email #{email.id}"

    notify_entity_created(entity_type, result, email, user)
  rescue StandardError => e
    # Check if it's a known error class for this entity type
    if config[:error_classes]&.any? { |klass| e.class.name == klass }
      Rails.logger.warn "[ProcessNewEntityEmails] #{e.class.name} for #{entity_type} email #{email.id}: #{e.message}"
    else
      Rails.logger.error "[ProcessNewEntityEmails] Failed to process #{entity_type} email #{email.id}: #{e.message}"
      Rails.logger.error e.backtrace.first(5).join("\n")
    end
  end

  def notify_entity_created(entity_type, result, email, user)
    case entity_type
    when :task
      notify_task_created(result, email)
    else
      # Jobs and cases just log for now
      Rails.logger.info "[ProcessNewEntityEmails] #{entity_type.to_s.capitalize} #{result.id} ready for review by #{user.name}"
    end
  end

  def notify_task_created(task, email)
    return unless task.respond_to?(:assigned_user_id) && task.assigned_user_id.present?

    # Skip self-notification when sender = assigned user
    sender_user = User.find_by("LOWER(email) = ?", email.from_email&.downcase)
    return if sender_user && sender_user.id == task.assigned_user_id

    Notification.create!(
      user_id: task.assigned_user_id,
      notification_type: "task_created_from_email",
      notifiable: task,
      title: "Task created from email",
      message: "A task was created from email: #{task.name}"
    )
  rescue StandardError => e
    Rails.logger.error "[ProcessNewEntityEmails] Failed to send task notification: #{e.message}"
  end
end
