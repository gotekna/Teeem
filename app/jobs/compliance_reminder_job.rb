class ComplianceReminderJob < ApplicationJob
  queue_as :default

  # Run daily to check for compliance items needing reminders
  def perform
    Rails.logger.info("Starting daily compliance reminder check...")

    service = ComplianceReminderService.new
    result = service.send_reminders

    if result[:success]
      Rails.logger.info("Compliance reminders completed: #{result[:reminders_sent]} reminders sent")
    else
      Rails.logger.error("Compliance reminders failed: #{result[:error]}")
    end
  rescue StandardError => e
    Rails.logger.error("Compliance reminder job failed: #{e.message}")
    raise
  end
end
