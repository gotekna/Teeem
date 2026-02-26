# frozen_string_literal: true

# Recurring job: fetches Xero bills for jobs and matches them to native POs,
# then writes the PO number to the Xero bill's Reference field.
#
# Runs daily at 7am Brisbane time. Safe to re-run (idempotent - skips already-matched).
# See XeroBillPoMatcherService for matching logic.
class XeroBillPoMatchJob < ApplicationJob
  include DeduplicatableJob
  queue_as :xero_sync

  # 5 min time budget — shared worker is single-threaded (R14 prevention),
  # so long-running jobs block ALL other queues. Idempotent: resumes next run.
  # FRC (Feb 2026): Was 30 min, blocked default queue jobs for 20+ min at 7am peak.
  TIME_BUDGET_SECONDS = 5.minutes.to_i

  # ⚠️ FRC (Feb 2026): Must iterate over tenants
  # Root cause: PurchaseOrder and XeroJobTrackingLink have acts_as_tenant.
  # Without tenant context (require_tenant=false), queries return ALL tenants' data,
  # matching Tenant A's bills to Tenant B's POs (cross-tenant data corruption).
  def perform(_options = {})
    @start_time = Time.current
    Rails.logger.info("[XeroBillPoMatchJob] Starting automatic Xero bill → PO matching (#{TIME_BUDGET_SECONDS / 60}min budget)")

    total_stats = { jobs_processed: 0, matched: 0, updated_xero: 0, errors: [], timed_out: false }

    Tenant.find_each do |tenant|
      if time_budget_exceeded?
        total_stats[:timed_out] = true
        Rails.logger.warn("[XeroBillPoMatchJob] Time budget exceeded (#{elapsed_minutes}min), stopping gracefully")
        break
      end

      ActsAsTenant.with_tenant(tenant) do
        # Skip tenants without Xero credentials — no API calls possible
        next unless XeroCredential.exists?
        match_for_tenant(total_stats)
      end
    end

    Rails.logger.info("[XeroBillPoMatchJob] Complete in #{elapsed_minutes}min: #{total_stats.except(:errors).inspect}, errors=#{total_stats[:errors].length}")
  rescue XeroApiClient::AuthenticationError => e
    Rails.logger.error("[XeroBillPoMatchJob] Auth failed - Xero may need reconnection: #{e.message}")
  rescue StandardError => e
    Rails.logger.error("[XeroBillPoMatchJob] Failed: #{e.message}\n#{e.backtrace.first(5).join("\n")}")
  end

  private

  def match_for_tenant(total_stats)
    # Find all jobs that have both: native POs AND a Xero tracking link
    job_ids_with_pos = PurchaseOrder.where(xero_invoice_id: [nil, ""]).distinct.pluck(:job_id)
    job_ids_with_tracking = XeroJobTrackingLink.distinct.pluck(:job_id)
    matchable_job_ids = job_ids_with_pos & job_ids_with_tracking

    return if matchable_job_ids.empty?

    total_unlinked = PurchaseOrder.where(xero_invoice_id: [nil, ""]).count
    Rails.logger.info("[XeroBillPoMatchJob] #{ActsAsTenant.current_tenant.name}: #{matchable_job_ids.length} jobs, #{total_unlinked} unlinked POs")

    matchable_job_ids.each do |job_id|
      if time_budget_exceeded?
        Rails.logger.warn("[XeroBillPoMatchJob] Time budget exceeded at job_id=#{job_id}, stopping")
        break
      end

      job = Job.find_by(id: job_id)
      next unless job

      begin
        service = XeroBillPoMatcherService.new(job: job)
        result = service.match_and_update!
        total_stats[:jobs_processed] += 1
        total_stats[:matched] += result[:matched]
        total_stats[:updated_xero] += result[:updated_xero]
        total_stats[:errors].concat(result[:errors])
      rescue StandardError => e
        Rails.logger.error("[XeroBillPoMatchJob] Failed for job #{job.job_code}: #{e.message}")
        total_stats[:errors] << "Job #{job.job_code}: #{e.message}"
      end
    end
  end

  def time_budget_exceeded?
    @start_time && (Time.current - @start_time) > TIME_BUDGET_SECONDS
  end

  def elapsed_minutes
    @start_time ? ((Time.current - @start_time) / 60).round(1) : 0
  end
end
