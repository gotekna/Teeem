# frozen_string_literal: true

# BackfillImapEmailBlobsJob - Create WarehouseDocuments for existing IMAP emails
#
# FRC (Jan 2026): IMAP emails had body content stored in DB but no WarehouseDocument/StorageBlob.
# This job backfills existing IMAP emails by re-fetching from IMAP server and storing to blob.
#
# Unlike Microsoft emails which can be fetched anytime via Graph API, IMAP emails require
# re-connecting to the IMAP server to get the raw content.
#
# Usage:
#   BackfillImapEmailBlobsJob.perform_later(batch_size: 50)
#   BackfillImapEmailBlobsJob.perform_later(credential_id: 123, batch_size: 50)
#
class BackfillImapEmailBlobsJob < ApplicationJob
  queue_as :low

  def perform(batch_size: 50, credential_id: nil)
    Rails.logger.info "[BackfillImapBlobs] Starting backfill (batch_size: #{batch_size})"

    # Find IMAP emails without WarehouseDocument
    query = SyncedEmail.unscoped
      .where(source_type: "imap")
      .left_joins(:warehouse_document)
      .where(warehouse_documents: { id: nil })

    if credential_id.present?
      query = query.where(imap_credential_id: credential_id)
    end

    # Group by credential for efficient IMAP connection reuse
    emails_by_credential = query.limit(batch_size).group_by(&:imap_credential_id)

    if emails_by_credential.empty?
      Rails.logger.info "[BackfillImapBlobs] No IMAP emails need backfill"
      return { processed: 0, uploaded: 0, errors: 0 }
    end

    total_processed = 0
    total_uploaded = 0
    total_errors = 0

    emails_by_credential.each do |cred_id, emails|
      credential = ImapCredential.find_by(id: cred_id)
      next unless credential
      # Skip if credential has sync error (likely auth issue)
      next if credential.last_sync_status == "error"

      tenant = credential.user&.tenant
      next unless tenant

      ActsAsTenant.with_tenant(tenant) do
        service = ImapEmailService.new(credential)

        emails.each do |email|
          begin
            # Fetch the raw content from IMAP server by UID
            raw_content = fetch_email_content(service, email)

            if raw_content.present?
              store_email_to_blob(email, raw_content, tenant)
              total_uploaded += 1
              print "."
            else
              Rails.logger.warn "[BackfillImapBlobs] Could not fetch content for email #{email.id}"
            end

            total_processed += 1
          rescue => e
            Rails.logger.error "[BackfillImapBlobs] Error for email #{email.id}: #{e.message}"
            total_errors += 1
          end
        end
      end
    end

    puts ""
    Rails.logger.info "[BackfillImapBlobs] Completed: #{total_uploaded} uploaded, #{total_errors} errors"

    # Check if more work remains
    remaining = SyncedEmail.unscoped
      .where(source_type: "imap")
      .left_joins(:warehouse_document)
      .where(warehouse_documents: { id: nil })
      .count

    if remaining > 0
      Rails.logger.info "[BackfillImapBlobs] #{remaining} IMAP emails still need blobs - queuing next batch"
      BackfillImapEmailBlobsJob.set(wait: 10.seconds).perform_later(batch_size: batch_size, credential_id: credential_id)
    end

    { processed: total_processed, uploaded: total_uploaded, errors: total_errors, remaining: remaining }
  end

  private

  def fetch_email_content(service, email)
    return nil unless email.uid.present? && email.folder_name.present?

    # Use the service's IMAP connection to fetch raw content
    service.send(:with_imap_connection) do |imap|
      imap.select(email.folder_name)

      # Fetch by UID
      fetch_data = imap.uid_fetch([email.uid], ["BODY.PEEK[]"])
      return nil unless fetch_data&.first

      fetch_data.first.attr["BODY[]"]
    end
  rescue => e
    Rails.logger.warn "[BackfillImapBlobs] Error fetching email #{email.id}: #{e.message}"
    nil
  end

  def store_email_to_blob(email, raw_content, tenant)
    return if email.warehouse_document.present?

    # Store to content-addressed blob storage
    blob = StorageBlob.find_or_create_for_content!(
      raw_content,
      filename: "#{email.id}.eml",
      content_type: "message/rfc822"
    )

    # Update email with storage paths
    email.update_columns(
      storage_path: blob.storage_path,
      storage_file_id: blob.id.to_s,
      storage_email_path: blob.storage_path,
      storage_email_file_id: blob.id.to_s
    )

    # Create WarehouseDocument
    doc = WarehouseDocument.find_or_create_by!(
      documentable_type: "SyncedEmail",
      documentable_id: email.id
    ) do |d|
      d.storage_blob = blob
      d.source_type = "email"
      d.folder = email.virtual_folder_path
      d.display_name = email.subject.presence || "No Subject"
      d.original_filename = "#{email.id}.eml"
      d.tenant_id = tenant.id
      d.metadata = {
        subject: email.subject,
        from_email: email.from_email,
        received_at: email.received_at&.iso8601,
        mailbox: email.mailbox_owner_email
      }
    end

    blob.increment!(:reference_count) if doc.previously_new_record?
  end
end
