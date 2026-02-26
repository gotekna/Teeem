# frozen_string_literal: true

# EmailCleanupJob - Clean up ephemeral and content-unavailable emails
#
# FRC (Feb 2026): Merged CleanupEphemeralEmailsJob + CleanupUnavailableEmailsJob.
# Both are daily cleanup tasks that run at 3am. Running them separately was
# unnecessary — they share the same pattern (find stale emails, delete them).
#
# Phase 1: Ephemeral emails (GitHub notifications, calendar alerts, etc.)
# Phase 2: Content-unavailable emails (deleted from O365/Gmail by user)
#
# FRC (Feb 2026): Moved from :low/:default (shared worker) to :email_enrichment
# (email worker). Email cleanup is email work — violates the "all email work on
# email worker" rule when running on shared worker.
#
# Runs daily at 3am via recurring.yml on :email_enrichment queue.
#
# Usage:
#   EmailCleanupJob.perform_later(dry_run: false, batch_size: 500)
#   EmailCleanupJob.perform_later(dry_run: true)  # Preview only
#
class EmailCleanupJob < ApplicationJob
  include DeduplicatableJob
  queue_as :email_enrichment

  MAX_RUNTIME = 3.minutes

  def perform(dry_run: false, batch_size: 500)
    @started_at = Time.current
    results = { ephemeral: {}, unavailable: {} }

    results[:ephemeral] = cleanup_ephemeral_emails(dry_run: dry_run)
    results[:unavailable] = cleanup_unavailable_emails(dry_run: dry_run, batch_size: batch_size) if time_remaining?

    Rails.logger.info "[EmailCleanup] Completed: #{results.inspect}"
    results
  end

  # Class method to check what would be cleaned up without deleting
  def self.preview
    new.perform(dry_run: true)
  end

  # Class method to actually clean up
  def self.execute!(delete_from_outlook: false)
    new.perform(dry_run: false)
  end

  private

  def time_remaining?
    (Time.current - @started_at) < MAX_RUNTIME
  end

  # ============================================
  # Phase 1: Ephemeral email cleanup (from CleanupEphemeralEmailsJob)
  # ============================================

  def cleanup_ephemeral_emails(dry_run:)
    expired_count = 0
    deleted_count = 0
    error_count = 0

    expired_emails = SyncedEmail
      .where("email_classification->>'ephemeral' = ?", "true")
      .where("(email_classification->>'expires_at')::timestamp < ?", Time.current)

    total = expired_emails.count
    Rails.logger.info "[EmailCleanup/Ephemeral] Found #{total} expired ephemeral emails"

    return { expired: 0, deleted: 0, errors: 0, dry_run: dry_run } if total.zero?

    expired_emails.find_each do |email|
      break unless time_remaining?

      expired_count += 1

      if dry_run
        Rails.logger.info "[EmailCleanup/Ephemeral] Would delete: #{email.subject.to_s.truncate(50)}"
      else
        begin
          # Optionally delete from Microsoft 365
          delete_from_outlook(email)
          email.destroy!
          deleted_count += 1
        rescue StandardError => e
          Rails.logger.error "[EmailCleanup/Ephemeral] Error deleting email #{email.id}: #{e.message}"
          error_count += 1
        end
      end
    end

    { expired: expired_count, deleted: deleted_count, errors: error_count, dry_run: dry_run }
  end

  def delete_from_outlook(email)
    return unless email.outlook_id.present? && email.mailbox_owner_email.present?

    credential = if email.microsoft_credential_id.present?
                   MicrosoftCredential.find_by(id: email.microsoft_credential_id)
                 else
                   MicrosoftCredential.refreshable_app.first
                 end

    if credential&.valid_credential?
      client = MicrosoftAppGraphClient.new(credential)
      client.delete_user_email(email.mailbox_owner_email, email.outlook_id)
    end
  rescue StandardError => e
    Rails.logger.warn "[EmailCleanup/Ephemeral] Could not delete from Outlook: #{e.message}"
  end

  # ============================================
  # Phase 2: Unavailable email cleanup (from CleanupUnavailableEmailsJob)
  # ============================================

  def cleanup_unavailable_emails(dry_run:, batch_size:)
    unavailable_emails = SyncedEmail.unscoped.where(content_unavailable: true).limit(batch_size)

    if unavailable_emails.empty?
      Rails.logger.info "[EmailCleanup/Unavailable] No unavailable emails found"
      return { deleted: 0, remaining: 0, dry_run: dry_run }
    end

    deleted_count = 0

    unavailable_emails.each do |email|
      break unless time_remaining?

      if dry_run
        Rails.logger.info "[EmailCleanup/Unavailable] WOULD DELETE email #{email.id}: #{email.subject&.truncate(50)}"
        deleted_count += 1
      else
        delete_email_and_related(email)
        deleted_count += 1
      end
    end

    remaining = SyncedEmail.unscoped.where(content_unavailable: true).count
    Rails.logger.info "[EmailCleanup/Unavailable] #{deleted_count} #{dry_run ? 'would be ' : ''}deleted, #{remaining} remaining"

    { deleted: deleted_count, remaining: remaining, dry_run: dry_run }
  end

  def delete_email_and_related(email)
    ActiveRecord::Base.transaction do
      email.warehouse_document&.destroy
      email.attachment_documents.destroy_all if email.respond_to?(:attachment_documents)

      if defined?(SyncedEmailAppearance) && email.respond_to?(:synced_email_appearances)
        email.synced_email_appearances.destroy_all
      end

      EmailUserState.where(email_warehouse_id: email.id).delete_all if defined?(EmailUserState)

      email.destroy!
    end
  end
end
