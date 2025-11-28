class AssetReminderJob < ApplicationJob
  queue_as :default

  # Run daily to check for asset insurance and service reminders
  def perform
    Rails.logger.info("Starting daily asset reminder check...")

    service = AssetReminderService.new
    result = service.send_reminders

    if result[:success]
      Rails.logger.info("Asset reminders completed: #{result[:reminders_sent]} reminders sent")
    else
      Rails.logger.error("Asset reminders failed: #{result[:error]}")
    end
  rescue StandardError => e
    Rails.logger.error("Asset reminder job failed: #{e.message}")
    raise
  end
end
