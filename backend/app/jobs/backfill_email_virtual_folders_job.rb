# frozen_string_literal: true

# Phase 4: Virtual File Warehouse - Backfill EmailWarehouse virtual folders
#
# This job populates WarehouseDocument.folder for all EmailWarehouse records.
# After backfill, emails can be organized by mailbox in the File Warehouse:
#   Emails/{{Mailbox}}/Email Body/{{Year}}/{{Month}}
#
# Run manually via Rails console:
#   BackfillEmailVirtualFoldersJob.perform_now
#
# Or via Heroku:
#   heroku run rails "BackfillEmailVirtualFoldersJob.perform_now" --app teeemlive
#
# Progress is logged. Can be safely re-run (idempotent).
class BackfillEmailVirtualFoldersJob < ApplicationJob
  queue_as :low

  # Configuration
  BATCH_SIZE = 1000
  LOG_INTERVAL = 5000  # Log progress every N records

  def perform(options = {})
    start_time = Time.current
    processed = 0
    updated = 0
    skipped = 0
    errors = 0

    Rails.logger.info "[BackfillEmailVirtualFolders] Starting backfill..."

    # First, backfill email_mailbox_id where missing
    backfill_mailbox_ids

    # Process emails with warehouse_documents
    EmailWarehouse.includes(:warehouse_document, :email_mailbox)
                  .find_each(batch_size: BATCH_SIZE) do |email|
      processed += 1

      # Skip if no warehouse_document
      unless email.warehouse_document.present?
        skipped += 1
        next
      end

      begin
        new_folder = email.virtual_folder_path

        # Skip if already set correctly
        if email.warehouse_document.folder == new_folder
          skipped += 1
          next
        end

        # Update warehouse_document.folder
        email.warehouse_document.update_column(:folder, new_folder)
        updated += 1
      rescue StandardError => e
        errors += 1
        Rails.logger.error "[BackfillEmailVirtualFolders] Error processing email #{email.id}: #{e.message}"
      end

      # Log progress
      if (processed % LOG_INTERVAL).zero?
        Rails.logger.info "[BackfillEmailVirtualFolders] Progress: #{processed} processed, #{updated} updated, #{skipped} skipped, #{errors} errors"
      end
    end

    elapsed = Time.current - start_time
    Rails.logger.info "[BackfillEmailVirtualFolders] Complete! #{processed} processed, #{updated} updated, #{skipped} skipped, #{errors} errors in #{elapsed.round(1)}s"

    {
      processed: processed,
      updated: updated,
      skipped: skipped,
      errors: errors,
      elapsed_seconds: elapsed.round(1)
    }
  end

  private

  # Backfill email_mailbox_id from mailbox_owner_email
  def backfill_mailbox_ids
    Rails.logger.info "[BackfillEmailVirtualFolders] Backfilling email_mailbox_id..."

    # Cache mailbox lookup
    mailbox_map = EmailMailbox.pluck(:email_address, :id).to_h

    updated_count = 0

    EmailWarehouse.where(email_mailbox_id: nil)
                  .where.not(mailbox_owner_email: [nil, ""])
                  .find_each(batch_size: BATCH_SIZE) do |email|
      normalized_email = email.mailbox_owner_email.downcase.strip
      mailbox_id = mailbox_map[normalized_email]

      if mailbox_id.present?
        email.update_column(:email_mailbox_id, mailbox_id)
        updated_count += 1
      end
    end

    Rails.logger.info "[BackfillEmailVirtualFolders] Backfilled #{updated_count} email_mailbox_id values"
  end
end
