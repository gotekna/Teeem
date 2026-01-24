# frozen_string_literal: true

# GenerateEmailEmlJob - Generate .eml files for emails missing storage_path
#
# Uses EmlGeneratorService to reconstruct .eml from database (NO Outlook needed).
# This fills the gap where OrgEmailSyncJob syncs metadata but doesn't create .eml files.
#
# Scheduled: Every 30 minutes (after email sync completes)
#
# Usage:
#   GenerateEmailEmlJob.perform_later                    # Process batch of 100
#   GenerateEmailEmlJob.perform_later(batch_size: 500)   # Custom batch size
#
class GenerateEmailEmlJob < ApplicationJob
  queue_as :low

  # Default batch size - balance between throughput and memory
  DEFAULT_BATCH_SIZE = 100

  def perform(batch_size: DEFAULT_BATCH_SIZE)
    emails = SyncedEmail
      .where(storage_path: [nil, ""])
      .order(:id)
      .limit(batch_size)

    total = emails.count
    return if total == 0

    Rails.logger.info "[GenerateEmailEmlJob] Processing #{total} emails without .eml files"

    generated = 0
    failed = 0

    emails.find_each do |email|
      result = EmlGeneratorService.generate_and_upload(email)
      if result
        generated += 1
      else
        failed += 1
        Rails.logger.warn "[GenerateEmailEmlJob] Failed to generate .eml for email #{email.id}"
      end
    rescue StandardError => e
      failed += 1
      Rails.logger.error "[GenerateEmailEmlJob] Error for email #{email.id}: #{e.message}"
    end

    Rails.logger.info "[GenerateEmailEmlJob] Completed: #{generated} generated, #{failed} failed"

    # Check if more emails need processing
    remaining = SyncedEmail.where(storage_path: [nil, ""]).count
    if remaining > 0
      Rails.logger.info "[GenerateEmailEmlJob] #{remaining} emails still need .eml files"
    end
  end
end
