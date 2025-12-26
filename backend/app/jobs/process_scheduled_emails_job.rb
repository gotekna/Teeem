# frozen_string_literal: true

# Processes all scheduled emails that are due to be sent
# Runs every 5 minutes to check for emails scheduled for delivery
class ProcessScheduledEmailsJob < ApplicationJob
  queue_as :default

  def perform
    Rails.logger.info("[ProcessScheduledEmailsJob] Starting scheduled email processing")

    result = ScheduledEmail.process_due!

    Rails.logger.info("[ProcessScheduledEmailsJob] Complete: processed=#{result[:processed]}, failed=#{result[:failed]}")

    result
  end
end
