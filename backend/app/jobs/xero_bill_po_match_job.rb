# frozen_string_literal: true

# Recurring job: fetches Xero bills for jobs and matches them to native POs,
# then writes the PO number to the Xero bill's Reference field.
#
# Runs daily at 7am Brisbane time. Safe to re-run (idempotent - skips already-matched).
# See XeroBillPoMatcherService for matching logic.
class XeroBillPoMatchJob < ApplicationJob
  queue_as :xero_sync

  def perform(_options = {})
    Rails.logger.info("[XeroBillPoMatchJob] Starting automatic Xero bill → PO matching")

    total_stats = { jobs_processed: 0, matched: 0, updated_xero: 0, errors: [] }

    # Find all jobs that have both: native POs AND a Xero tracking link
    job_ids_with_pos = PurchaseOrder.where(xero_invoice_id: [nil, ""]).distinct.pluck(:job_id)
    job_ids_with_tracking = XeroJobTrackingLink.distinct.pluck(:job_id)
    matchable_job_ids = job_ids_with_pos & job_ids_with_tracking

    Rails.logger.info("[XeroBillPoMatchJob] #{matchable_job_ids.length} jobs have both native POs and Xero tracking")

    matchable_job_ids.each do |job_id|
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

    Rails.logger.info("[XeroBillPoMatchJob] Complete: #{total_stats.except(:errors).inspect}, errors=#{total_stats[:errors].length}")
  rescue XeroApiClient::AuthenticationError => e
    Rails.logger.error("[XeroBillPoMatchJob] Auth failed - Xero may need reconnection: #{e.message}")
  rescue StandardError => e
    Rails.logger.error("[XeroBillPoMatchJob] Failed: #{e.message}\n#{e.backtrace.first(5).join("\n")}")
  end
end
