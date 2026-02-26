# frozen_string_literal: true

# BackfillImapEmailBlobsJob - Create WarehouseDocuments for IMAP emails
#
# Uploads IMAP email .eml files to Wasabi by re-fetching from IMAP server.
# Unlike MS365 emails (fetched via Graph API), IMAP requires reconnecting to the server.
#
# FRC (Feb 2026): Promoted from one-off backfill to recurring job (every 5 min).
# Uses auto-continue loop (same pattern as UploadEmailsToStorageJob) instead of
# perform_later chain which was silently aborted by DeduplicatableJob.
#
# Usage:
#   BackfillImapEmailBlobsJob.perform_later(batch_size: 100)
#   BackfillImapEmailBlobsJob.perform_later(credential_id: 123, batch_size: 100)
#
class BackfillImapEmailBlobsJob < ApplicationJob
  include DeduplicatableJob

  # FRC (Feb 2026): Moved from :default to :low to reduce queue pressure
  # Blob backfill is not user-facing; can run on Worker 2's idle threads
  queue_as :low

  # Max runtime before yielding back to the scheduler
  MAX_RUNTIME_SECONDS = 10 * 60  # 10 minutes

  def perform(batch_size: 100, credential_id: nil)
    @started_at = Time.current
    total_uploaded = 0
    total_errors = 0
    batch_number = 0

    loop do
      batch_number += 1
      break unless time_remaining?

      # Find IMAP emails without WarehouseDocument
      query = SyncedEmail.unscoped
        .where(source_type: "imap")
        .where.not(uid: [nil, ""])
        .where.not(imap_credential_id: nil)
        .left_joins(:warehouse_document)
        .where(warehouse_documents: { id: nil })

      query = query.where(imap_credential_id: credential_id) if credential_id.present?

      emails = query.limit(batch_size).to_a
      break if emails.empty?

      Rails.logger.info "[ImapUpload] Batch #{batch_number}: #{emails.count} emails"

      # Group by credential for efficient IMAP connection reuse
      emails_by_credential = emails.group_by(&:imap_credential_id)

      emails_by_credential.each do |cred_id, cred_emails|
        break unless time_remaining?

        credential = ImapCredential.find_by(id: cred_id)
        next unless credential
        next if credential.last_sync_status == "error"

        tenant = credential.user&.tenant
        next unless tenant

        ActsAsTenant.with_tenant(tenant) do
          begin
            service = ImapEmailService.new(credential)

            cred_emails.each do |email|
              break unless time_remaining?

              begin
                tempfile = fetch_email_to_tempfile(service, email)

                if tempfile
                  begin
                    store_email_from_tempfile(email, tempfile, tenant)
                    total_uploaded += 1
                  ensure
                    tempfile.close! rescue nil
                  end
                else
                  Rails.logger.warn "[ImapUpload] Could not fetch content for email #{email.id}"
                end
              rescue => e
                Rails.logger.error "[ImapUpload] Error for email #{email.id}: #{e.message}"
                total_errors += 1
              end
            end
          rescue => e
            Rails.logger.error "[ImapUpload] Connection error for credential #{cred_id}: #{e.message}"
          end
        end
      end

      # Check remaining
      remaining = SyncedEmail.unscoped
        .where(source_type: "imap")
        .where.not(uid: [nil, ""])
        .where.not(imap_credential_id: nil)
        .left_joins(:warehouse_document)
        .where(warehouse_documents: { id: nil })
        .count

      Rails.logger.info "[ImapUpload] Batch #{batch_number}: uploaded=#{total_uploaded}, errors=#{total_errors}, remaining=#{remaining}"
      break if remaining == 0
    end

    Rails.logger.info "[ImapUpload] Completed: #{total_uploaded} uploaded, #{total_errors} errors, #{batch_number} batches"
    { uploaded: total_uploaded, errors: total_errors }
  end

  private

  def time_remaining?
    (Time.current - @started_at) < MAX_RUNTIME_SECONDS
  end

  # Memory-safe: writes IMAP content directly to Tempfile instead of holding in heap.
  # Returns Tempfile on success, nil on failure. Caller must close! the Tempfile.
  def fetch_email_to_tempfile(service, email)
    return nil unless email.uid.present? && email.folder_name.present?

    service.send(:with_imap_connection) do |imap|
      imap.select(email.folder_name)
      fetch_data = imap.uid_fetch([email.uid], ["BODY.PEEK[]"])
      return nil unless fetch_data&.first

      raw_content = fetch_data.first.attr["BODY[]"]
      return nil unless raw_content.present?

      tempfile = Tempfile.new(["imap_email_#{email.id}", ".eml"], binmode: true)
      tempfile.write(raw_content)
      tempfile.flush
      tempfile.rewind

      # Release the String from heap immediately
      raw_content = nil

      tempfile
    end
  rescue => e
    Rails.logger.warn "[ImapUpload] Error fetching email #{email.id}: #{e.message}"
    nil
  end

  # Memory-safe: uses StorageBlob.find_or_create_from_file! (disk-backed hash + upload)
  def store_email_from_tempfile(email, tempfile, tenant)
    return if email.warehouse_document.present?

    blob = StorageBlob.find_or_create_from_file!(
      tempfile.path,
      filename: "#{email.id}.eml",
      content_type: "message/rfc822"
    )

    email.update_columns(
      storage_path: blob.storage_path,
      storage_file_id: blob.id.to_s,
      storage_email_path: blob.storage_path,
      storage_email_file_id: blob.id.to_s
    )

    WarehouseDocument.find_or_create_by!(
      documentable_type: "SyncedEmail",
      documentable_id: email.id
    ) do |d|
      d.storage_blob = blob
      d.source_type = "email"
      d.ui_name = email.subject.presence || "No Subject"
      d.original_filename = "#{email.id}.eml"
      d.tenant_id = tenant.id
      d.metadata = {
        "subject" => email.subject,
        "from_email" => email.from_email,
        "received_at" => email.received_at&.iso8601,
        "mailbox" => email.mailbox_owner_email
      }
    end

    blob.increment!(:reference_count)
  rescue ActiveRecord::RecordNotUnique
    Rails.logger.info "[ImapUpload] WarehouseDocument race condition for email #{email.id}"
  end
end
