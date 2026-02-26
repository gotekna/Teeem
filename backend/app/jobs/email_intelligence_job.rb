# frozen_string_literal: true

# EmailIntelligenceJob - Recurring batch AI processing for email intelligence
#
# Runs every 10 minutes on :email_enrichment queue (teeem-email-worker).
# Iterates all tenants and processes up to 50 unprocessed emails per tenant.
#
# Populates: ai_summary, action_items, follow_up_required, follow_up_date,
# follow_up_reason, ai_processed_at on synced_emails.
#
# Cost: ~$1.20/month (Haiku)
#
class EmailIntelligenceJob < ApplicationJob
  include DeduplicatableJob
  # FRC (Feb 2026): Moved from :email_sync to :email_enrichment.
  # AI summaries are enrichment, not sync. On :email_sync it competed with
  # OrgEmailSyncJob/ImapSyncJob for the email worker's single thread.
  queue_as :email_enrichment

  # FRC (Feb 2026): Time budget to prevent starving email_enrichment jobs.
  # Email worker has 1 thread shared between email_sync + email_enrichment.
  MAX_RUNTIME = 3.minutes

  def perform
    @started_at = Time.current
    Rails.logger.info "[EmailIntelligenceJob] Starting email intelligence processing"

    total_stats = { processed: 0, skipped: 0, errors: 0, tenants: 0 }

    Tenant.find_each do |tenant|
      break unless time_remaining?

      ActsAsTenant.with_tenant(tenant) do
        # Skip tenants with no unprocessed emails
        pending_count = SyncedEmail.needs_ai_processing
          .not_spam
          .where("received_at > ?", 30.days.ago)
          .where.not(body_text: [nil, ""])
          .count

        next if pending_count == 0

        service = EmailIntelligenceService.new(tenant: tenant)
        stats = service.process_batch(limit: 50)

        total_stats[:processed] += stats[:processed]
        total_stats[:skipped] += stats[:skipped]
        total_stats[:errors] += stats[:errors]
        total_stats[:tenants] += 1
      end
    rescue StandardError => e
      Rails.logger.error "[EmailIntelligenceJob] Error processing tenant #{tenant.id}: #{e.message}"
      total_stats[:errors] += 1
    end

    Rails.logger.info "[EmailIntelligenceJob] Complete: #{total_stats.inspect}"
  end

  private

  def time_remaining?
    (Time.current - @started_at) < MAX_RUNTIME
  end
end
