# frozen_string_literal: true

# DraftSyncJob - Background sync of email drafts to provider Drafts folder
#
# Keeps controller responses fast: auto-save writes to TEEEM DB immediately,
# then this job syncs to the provider (MS365 or IMAP) in the background.
#
# Usage:
#   DraftSyncJob.perform_later(email_draft.id)
#
class DraftSyncJob < ApplicationJob
  queue_as :default

  # Don't retry aggressively - draft sync is best-effort
  retry_on StandardError, wait: 30.seconds, attempts: 2

  # Dead tokens need manual re-auth - don't retry
  discard_on Microsoft::BaseClient::DeadTokenError

  def perform(email_draft_id)
    draft = EmailDraft.find_by(id: email_draft_id)
    return unless draft&.draft?

    DraftSyncService.sync_to_provider(draft)
  end
end
