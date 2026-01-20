# Cleans up ephemeral emails (GitHub notifications, calendar alerts, etc.)
# that have passed their retention period
#
# These emails are useful briefly but become noise:
# - GitHub Actions: 7 days (deploy/build notifications)
# - Calendar: 7 days (reminders, invitations)
# - System alerts: 14 days (Heroku, Sentry alerts)
# - Shipping: 30 days (tracking notifications)
#
# Run daily via Solid Queue recurring job
class CleanupEphemeralEmailsJob < ApplicationJob
  queue_as :default

  def perform(options = {})
    dry_run = options[:dry_run] != false  # Default to dry run for safety
    delete_from_outlook = options[:delete_from_outlook] == true

    Rails.logger.info "[EphemeralCleanup] Starting cleanup (dry_run=#{dry_run})"

    expired_count = 0
    deleted_count = 0
    error_count = 0

    # Find emails marked as ephemeral that have expired
    expired_emails = SyncedEmail
      .where("email_classification->>'ephemeral' = ?", "true")
      .where("(email_classification->>'expires_at')::timestamp < ?", Time.current)

    total = expired_emails.count
    Rails.logger.info "[EphemeralCleanup] Found #{total} expired ephemeral emails"

    return { expired: 0, deleted: 0, errors: 0, dry_run: dry_run } if total.zero?

    expired_emails.find_each do |email|
      expired_count += 1
      ephemeral_type = email.email_classification["ephemeral_type"]
      expires_at = email.email_classification["expires_at"]

      if dry_run
        Rails.logger.info "[EphemeralCleanup] Would delete: #{email.subject.to_s.truncate(50)} (#{ephemeral_type}, expired #{expires_at})"
      else
        begin
          # Optionally delete from Microsoft 365 first
          # SSoT: Per-user Outlook credentials removed - uses org credentials
          if delete_from_outlook && email.outlook_id.present? && email.mailbox_owner_email.present?
            # SSoT: Use MicrosoftCredential
          credential = if email.microsoft_credential_id.present?
                           MicrosoftCredential.find_by(id: email.microsoft_credential_id)
                         else
                           MicrosoftCredential.app_credentials.connected.first
                         end
            if credential&.valid_credential?
              client = MicrosoftAppGraphClient.new(credential)
              client.delete_user_email(email.mailbox_owner_email, email.outlook_id)
            end
          end

          # Remove from our database
          email.destroy!
          deleted_count += 1

          Rails.logger.info "[EphemeralCleanup] Deleted: #{email.subject.to_s.truncate(50)} (#{ephemeral_type})"
        rescue StandardError => e
          Rails.logger.error "[EphemeralCleanup] Error deleting email #{email.id}: #{e.message}"
          error_count += 1
        end
      end
    end

    summary = {
      expired: expired_count,
      deleted: deleted_count,
      errors: error_count,
      dry_run: dry_run
    }

    Rails.logger.info "[EphemeralCleanup] Complete: #{summary.inspect}"
    summary
  end

  # Class method to check what would be cleaned up without deleting
  def self.preview
    new.perform(dry_run: true)
  end

  # Class method to actually clean up
  def self.execute!(delete_from_outlook: false)
    new.perform(dry_run: false, delete_from_outlook: delete_from_outlook)
  end
end
