# frozen_string_literal: true

# EmlGeneratorService - Generate .eml files from database records
#
# Ultra approach: Instead of fetching from Outlook (slow, may be deleted),
# reconstruct .eml from data we already have in synced_emails table.
#
# Usage:
#   content = EmlGeneratorService.generate(synced_email)
#   # Returns RFC 5322 compliant email content
#
class EmlGeneratorService
  class << self
    # Generate .eml content from a SyncedEmail record
    def generate(email)
      unless email.is_a?(SyncedEmail)
        Rails.logger.warn("[EmlGenerator] Cannot generate: not a SyncedEmail (got #{email.class.name})")
        return nil
      end

      mail = Mail.new

      # Core headers
      mail.message_id = email.internet_message_id if email.internet_message_id.present?
      mail.subject = email.subject
      mail.date = email.received_at || email.sent_at || email.created_at

      # Addresses - handle missing from gracefully
      from_addr = format_address(email.from_name, email.from_email)
      mail.from = from_addr.presence || "unknown@teeem.app"
      mail.to = email.to_emails if email.to_emails.present?
      mail.cc = email.cc_emails if email.cc_emails.present?
      mail.bcc = email.bcc_emails if email.bcc_emails.present?

      # Reply threading
      mail.in_reply_to = email.in_reply_to if email.in_reply_to.present?
      mail.references = email.references.join(" ") if email.references.present?

      # Restore original headers we captured
      add_internet_headers(mail, email.internet_headers) if email.internet_headers.present?

      # Body - prefer multipart if we have both
      if email.body_html.present? && email.body_text.present?
        mail.text_part = Mail::Part.new do
          content_type "text/plain; charset=UTF-8"
          body email.body_text
        end

        mail.html_part = Mail::Part.new do
          content_type "text/html; charset=UTF-8"
          body email.body_html
        end
      elsif email.body_html.present?
        mail.content_type = "text/html; charset=UTF-8"
        mail.body = email.body_html
      else
        mail.content_type = "text/plain; charset=UTF-8"
        mail.body = email.body_text || ""
      end

      # Add attachments if they exist and have content
      add_attachments(mail, email) if email.email_attachments.any?

      mail.to_s
    rescue StandardError => e
      Rails.logger.error("[EmlGenerator] Failed to generate .eml for email #{email.id}: #{e.class} - #{e.message}")
      Rails.logger.error(e.backtrace.first(5).join("\n"))
      nil
    end

    # Generate and upload to S3, returning the storage path
    def generate_and_upload(email)
      content = generate(email)
      return nil unless content

      # Upload to S3 - get organization from email's credential
      organization = email.microsoft_credential&.organization ||
                     email.imap_credential&.organization ||
                     Organization.first
      provider = DocumentProviders.for_organization(organization)
      return nil unless provider

      # Use StorageConfiguration for path template
      storage_config = StorageConfiguration.instance
      year = (email.received_at || email.created_at).year
      month = (email.received_at || email.created_at).strftime("%m")
      mailbox = email.mailbox_owner_email&.split("@")&.first || "unknown"

      base_path = storage_config&.path_for(:email) || "Emails"
      folder_path = base_path.gsub("{{Mailbox}}", mailbox)
                             .gsub("{{Year}}", year.to_s)
                             .gsub("{{Month}}", month)

      filename = "#{email.id}.eml"

      result = provider.upload_file(folder_path, content, filename, content_type: "message/rfc822")

      # Update email record
      email.update_columns(
        storage_path: result[:path],
        storage_file_id: result[:id]
      )

      # Update or create StorageBlob
      blob = StorageBlob.find_or_create_by!(storage_path: result[:path]) do |b|
        b.content_hash = Digest::SHA256.hexdigest(content)
        b.file_size = content.bytesize
        b.original_filename = filename
        b.content_type = "message/rfc822"
        b.reference_count = 0
      end

      # Update WarehouseDocument if exists
      if email.warehouse_document
        email.warehouse_document.update!(storage_blob: blob) unless email.warehouse_document.storage_blob_id == blob.id
      else
        WarehouseDocument.create!(
          documentable: email,
          storage_blob: blob,
          source_type: "email",
          folder: email.virtual_folder_path,
          display_name: email.subject.presence || "No Subject",
          original_filename: filename,
          metadata: {
            subject: email.subject,
            from_email: email.from_email,
            received_at: email.received_at&.iso8601,
            mailbox: email.mailbox_owner_email,
            generated: true
          }
        )
      end

      blob.increment!(:reference_count) if blob.reference_count == 0

      result[:path]
    rescue StandardError => e
      Rails.logger.error("[EmlGenerator] Failed to generate/upload for email #{email.id}: #{e.message}")
      nil
    end

    private

    def format_address(name, email)
      return email if name.blank?

      "#{name} <#{email}>"
    end

    def add_internet_headers(mail, headers)
      # Skip headers we already set or that cause issues
      skip_headers = %w[
        from to cc bcc subject date message-id in-reply-to references
        content-type content-transfer-encoding mime-version
      ]

      headers.each do |key, value|
        next if skip_headers.include?(key.to_s.downcase)
        next if value.blank?

        # Some headers need special handling
        begin
          mail[key] = value
        rescue StandardError
          # Skip headers that can't be set (malformed, etc.)
        end
      end
    end

    def add_attachments(mail, email)
      email.email_attachments.each do |attachment|
        next unless attachment.storage_blob.present?

        begin
          content = attachment.download
          next unless content

          mail.attachments[attachment.filename || "attachment"] = {
            mime_type: attachment.content_type || "application/octet-stream",
            content: content
          }
        rescue StandardError => e
          Rails.logger.warn("[EmlGenerator] Could not add attachment #{attachment.id}: #{e.message}")
        end
      end
    end
  end
end
