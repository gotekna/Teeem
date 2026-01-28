# frozen_string_literal: true

# CleanupUnavailableEmailsJob - Remove emails marked as content_unavailable
#
# FRC (Jan 2026): Emails with content_unavailable=true are records where we synced
# the metadata but Microsoft/IMAP couldn't provide the content (deleted, permissions, etc.)
# These create noise in the dashboard ("missing blobs") with no way to recover.
#
# This job safely deletes these records after checking they're not linked to important data.
#
# Usage:
#   CleanupUnavailableEmailsJob.perform_later(dry_run: true)   # Preview what would be deleted
#   CleanupUnavailableEmailsJob.perform_later(dry_run: false)  # Actually delete
#
class CleanupUnavailableEmailsJob < ApplicationJob
  queue_as :low

  def perform(dry_run: true, batch_size: 100)
    Rails.logger.info "[CleanupUnavailable] Starting (dry_run: #{dry_run}, batch_size: #{batch_size})"

    # Find emails marked as content unavailable
    unavailable_emails = SyncedEmail.unscoped.where(content_unavailable: true).limit(batch_size)

    if unavailable_emails.empty?
      Rails.logger.info "[CleanupUnavailable] No unavailable emails found"
      return { deleted: 0, kept: 0, remaining: 0 }
    end

    deleted_count = 0
    kept_count = 0
    kept_reasons = []

    unavailable_emails.each do |email|
      # Check if email is linked to important records
      links = check_email_links(email)

      if links.any?
        kept_count += 1
        kept_reasons << { id: email.id, subject: email.subject&.truncate(50), links: links }
        Rails.logger.info "[CleanupUnavailable] KEPT email #{email.id} - linked to: #{links.join(', ')}"
      else
        if dry_run
          Rails.logger.info "[CleanupUnavailable] WOULD DELETE email #{email.id}: #{email.subject&.truncate(50)}"
          deleted_count += 1
        else
          delete_email_and_related(email)
          deleted_count += 1
          Rails.logger.info "[CleanupUnavailable] DELETED email #{email.id}: #{email.subject&.truncate(50)}"
        end
      end
    end

    # Check if more work remains
    remaining = SyncedEmail.unscoped.where(content_unavailable: true).count

    Rails.logger.info "[CleanupUnavailable] Completed: #{deleted_count} #{dry_run ? 'would be ' : ''}deleted, #{kept_count} kept (linked), #{remaining} remaining"

    # Queue next batch if not dry run and more remain
    if !dry_run && remaining > 0
      Rails.logger.info "[CleanupUnavailable] Queuing next batch..."
      CleanupUnavailableEmailsJob.set(wait: 5.seconds).perform_later(dry_run: false, batch_size: batch_size)
    end

    {
      deleted: deleted_count,
      kept: kept_count,
      kept_reasons: kept_reasons,
      remaining: remaining,
      dry_run: dry_run
    }
  end

  private

  def check_email_links(email)
    links = []

    # Check if linked to a job
    if email.respond_to?(:job_id) && email.job_id.present?
      links << "job:#{email.job_id}"
    end

    # Check if linked to a contact
    if email.respond_to?(:contact_id) && email.contact_id.present?
      links << "contact:#{email.contact_id}"
    end

    # Check if linked to a task
    if email.respond_to?(:task_id) && email.task_id.present?
      links << "task:#{email.task_id}"
    end

    # Check email_links table (many-to-many links to jobs/contacts)
    if defined?(EmailLink) && EmailLink.where(synced_email_id: email.id).exists?
      link_count = EmailLink.where(synced_email_id: email.id).count
      links << "email_links:#{link_count}"
    end

    links
  end

  def delete_email_and_related(email)
    ActiveRecord::Base.transaction do
      # Delete warehouse document if exists (but keep the blob - it's content-addressed)
      if email.warehouse_document.present?
        email.warehouse_document.destroy
      end

      # Delete email attachments
      if email.respond_to?(:email_attachments)
        email.email_attachments.destroy_all
      end

      # Delete mailbox appearances (email can appear in multiple mailboxes)
      if defined?(SyncedEmailAppearance) && email.respond_to?(:synced_email_appearances)
        email.synced_email_appearances.destroy_all
      end

      # Delete user states (read/unread tracking)
      if defined?(EmailUserState)
        EmailUserState.where(synced_email_id: email.id).delete_all
      end

      # Finally delete the email itself
      email.destroy!
    end
  end
end
