class ImapSyncJob < ApplicationJob
  queue_as :default

  # Retry network errors up to 2 times with backoff, then discard
  # Runs every 2 minutes, so next scheduled run will try again
  retry_on Net::OpenTimeout, Net::ReadTimeout, SocketError, Errno::ECONNREFUSED,
           wait: :polynomially_longer, attempts: 2

  # Discard other errors - next scheduled run will try again
  discard_on StandardError

  # Sync emails for a single IMAP credential
  def perform(credential_id = nil, full_sync: false)
    if credential_id
      # Sync specific credential
      credential = ImapCredential.find_by(id: credential_id)
      return unless credential&.is_active?

      sync_credential(credential, full_sync: full_sync)
    else
      # Sync all active credentials that are due
      ImapCredential.where(is_active: true).find_each do |credential|
        next unless credential.sync_due?

        sync_credential(credential, full_sync: full_sync)
      end
    end
  end

  private

  def sync_credential(credential, full_sync: false)
    Rails.logger.info "[ImapSyncJob] Starting sync for #{credential.email_address} (full_sync: #{full_sync})"

    service = ImapEmailService.new(credential)
    results = service.sync_to_warehouse(full_sync: full_sync)

    Rails.logger.info "[ImapSyncJob] Sync complete for #{credential.email_address}: " \
                      "#{results[:synced]} synced, #{results[:skipped]} skipped, #{results[:errors]} errors"

    # Process new emails for job matching
    if results[:new_emails].any?
      results[:new_emails].each do |email|
        ProcessNewEmailJob.perform_later(email.id) if email.persisted?
      end
    end

    results
  rescue => e
    Rails.logger.error "[ImapSyncJob] Error syncing #{credential.email_address}: #{e.message}"
    credential.mark_sync_error!(e.message)
    nil
  end
end
