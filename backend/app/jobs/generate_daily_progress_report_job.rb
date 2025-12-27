# frozen_string_literal: true

# GenerateDailyProgressReportJob - Daily AI progress report from site photos
#
# Part of Site Presence & Cost Intelligence System
# See: .claude/plans/piped-orbiting-whisper.md
#
# Runs daily at 7pm to analyze the day's photos and generate progress summaries.
# Uses Claude Vision to detect work completed.
#
class GenerateDailyProgressReportJob < ApplicationJob
  queue_as :default

  def perform(date: nil)
    date ||= Date.current

    Rails.logger.info "[DailyProgressReport] Generating reports for #{date}"

    service = WorkProgressDetectionService.new
    reports_generated = 0
    errors = []

    # Find all jobs with photos taken today
    job_ids = SmTaskPhoto.for_date(date).select(:job_id).distinct.pluck(:job_id).compact

    job_ids.each do |job_id|
      job = Job.find_by(id: job_id)
      next unless job

      begin
        report = service.generate_daily_report(job: job, date: date)

        if report[:photos_analyzed].positive?
          # Store report (could save to DB or send notification)
          store_report(job, date, report)
          reports_generated += 1
        end
      rescue StandardError => e
        errors << { job_id: job_id, error: e.message }
        Rails.logger.error "[DailyProgressReport] Job #{job_id} error: #{e.message}"
      end
    end

    Rails.logger.info "[DailyProgressReport] Generated #{reports_generated} reports for #{job_ids.length} jobs"

    {
      date: date,
      jobs_analyzed: job_ids.length,
      reports_generated: reports_generated,
      errors: errors
    }
  end

  private

  def store_report(job, date, report)
    # Store in job metadata or create a separate report record
    # For now, log the summary
    Rails.logger.info "[DailyProgressReport] Job: #{job.name}, Photos: #{report[:photos_analyzed]}, Trades: #{report[:trades_detected].join(', ')}"

    # TODO: Could store in a JobProgressReport model or send notification
    # Could also update job.progress_notes or similar field
  end
end
