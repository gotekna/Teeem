# frozen_string_literal: true

# Processes all scheduled reports that are due to be sent
# Runs every hour to check for reports scheduled for delivery
class ProcessScheduledReportsJob < ApplicationJob
  queue_as :low

  def perform
    Rails.logger.info("[ProcessScheduledReportsJob] Starting scheduled report processing")

    processed = 0
    failed = 0

    Gl::ScheduledReport.due_now.find_each do |report|
      begin
        if report.generate_and_send!
          processed += 1
          Rails.logger.info("[ProcessScheduledReportsJob] Sent report '#{report.name}' (ID: #{report.id})")
        else
          failed += 1
          Rails.logger.warn("[ProcessScheduledReportsJob] Failed to send report #{report.id}: #{report.last_error}")
        end
      rescue StandardError => e
        failed += 1
        Rails.logger.error("[ProcessScheduledReportsJob] Error processing report #{report.id}: #{e.message}")
        report.update(last_error: e.message)
      end
    end

    Rails.logger.info("[ProcessScheduledReportsJob] Complete: processed=#{processed}, failed=#{failed}")
  end
end
