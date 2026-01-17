# frozen_string_literal: true

# Phase 6: Backfill WarehouseDocument metadata from source tables
#
# Migrates metadata from source records (EmailWarehouse, JobDocument, etc.)
# into WarehouseDocument.metadata JSONB column.
#
# After backfill, queries can use WarehouseDocument directly without JOINs.
#
# Usage:
#   # Dry run
#   BackfillWarehouseDocumentMetadataJob.perform_now(dry_run: true, limit: 100)
#
#   # Full backfill
#   BackfillWarehouseDocumentMetadataJob.perform_now(dry_run: false)
#
#   # Specific source type
#   BackfillWarehouseDocumentMetadataJob.perform_now(source_type: 'email')
#
# Via Heroku:
#   heroku run rails runner "BackfillWarehouseDocumentMetadataJob.perform_now(dry_run: true, limit: 100)" --app teeemlive
#
class BackfillWarehouseDocumentMetadataJob < ApplicationJob
  queue_as :low

  BATCH_SIZE = 500
  LOG_INTERVAL = 2000

  def perform(options = {})
    dry_run = options.fetch(:dry_run, true)
    limit = options[:limit]
    source_type = options[:source_type]

    start_time = Time.current
    stats = { processed: 0, updated: 0, skipped: 0, errors: 0 }

    Rails.logger.info "[MetadataBackfill] Starting (dry_run=#{dry_run}, source_type=#{source_type || 'all'})..."

    # Query WarehouseDocuments that need metadata backfill
    scope = WarehouseDocument.includes(:documentable)
    scope = scope.where(source_type: source_type) if source_type.present?
    scope = scope.limit(limit) if limit

    scope.find_each(batch_size: BATCH_SIZE) do |wd|
      stats[:processed] += 1

      begin
        # Skip if no documentable
        unless wd.documentable.present?
          stats[:skipped] += 1
          next
        end

        # Extract metadata based on documentable type
        new_metadata = extract_metadata(wd)

        # Skip if no metadata to add
        if new_metadata.blank?
          stats[:skipped] += 1
          next
        end

        # Skip if metadata already populated with same values
        if metadata_already_set?(wd, new_metadata)
          stats[:skipped] += 1
          next
        end

        unless dry_run
          wd.update_column(:metadata, (wd.metadata || {}).merge(new_metadata))
        end

        stats[:updated] += 1
      rescue StandardError => e
        stats[:errors] += 1
        Rails.logger.error "[MetadataBackfill] Error WD##{wd.id}: #{e.message}"
      end

      log_progress(stats) if (stats[:processed] % LOG_INTERVAL).zero?
    end

    elapsed = Time.current - start_time
    Rails.logger.info "[MetadataBackfill] Complete! #{stats.merge(elapsed_seconds: elapsed.round(1)).inspect}"
    stats.merge(elapsed_seconds: elapsed.round(1))
  end

  private

  def extract_metadata(wd)
    case wd.documentable_type
    when "EmailWarehouse"
      extract_email_metadata(wd.documentable)
    when "EmailAttachment"
      extract_attachment_metadata(wd.documentable)
    when "JobDocument"
      extract_job_document_metadata(wd.documentable)
    when "CorporateCompanyDocument"
      extract_corporate_document_metadata(wd.documentable)
    when "ContactDocument"
      extract_contact_document_metadata(wd.documentable)
    else
      {}
    end
  end

  def extract_email_metadata(email)
    {
      "subject" => email.subject,
      "from_email" => email.from_email,
      "from_name" => email.from_name,
      "to_emails" => email.to_emails,
      "cc_emails" => email.cc_emails,
      "received_at" => email.received_at&.iso8601,
      "mailbox" => email.mailbox_owner_email,
      "message_id" => email.message_id,
      "direction" => email.respond_to?(:direction) ? email.direction : nil,
      "has_attachments" => email.respond_to?(:has_attachments?) ? email.has_attachments? : false
    }.compact
  end

  def extract_attachment_metadata(att)
    email = att.email_warehouse
    {
      "filename" => att.filename,
      "content_type" => att.content_type,
      "file_size" => att.file_size,
      "parent_email_id" => email&.id,
      "parent_email_subject" => email&.subject,
      "received_at" => email&.received_at&.iso8601,
      "mailbox" => email&.mailbox_owner_email
    }.compact
  end

  def extract_job_document_metadata(doc)
    job = doc.job
    {
      "job_id" => job&.id,
      "job_code" => job&.job_code,
      "job_name" => job&.job_name,
      "document_type" => doc.document_type&.name,
      "document_type_id" => doc.document_type_id,
      "folder_path" => doc.respond_to?(:folder_path) ? doc.folder_path : nil,
      "filename" => doc.filename,
      "file_size" => doc.respond_to?(:file_size) ? doc.file_size : nil,
      "version_status" => doc.respond_to?(:version_status) ? doc.version_status : nil
    }.compact
  end

  def extract_corporate_document_metadata(doc)
    company = doc.corporate_company
    {
      "company_id" => company&.id,
      "company_code" => company&.company_code,
      "company_name" => company&.company_name,
      "document_type" => doc.document_type_record&.name,
      "document_type_id" => doc.document_type_id,
      "filename" => doc.filename,
      "file_size" => doc.respond_to?(:file_size) ? doc.file_size : nil,
      "description" => doc.respond_to?(:description) ? doc.description : nil
    }.compact
  end

  def extract_contact_document_metadata(doc)
    contact = doc.contact
    {
      "contact_id" => contact&.id,
      "contact_name" => contact&.display_name,
      "document_type" => doc.respond_to?(:document_type) ? doc.document_type&.name : nil,
      "filename" => doc.respond_to?(:filename) ? doc.filename : nil
    }.compact
  end

  def metadata_already_set?(wd, new_metadata)
    return false if wd.metadata.blank?

    # Check if all new metadata keys are already present with same values
    new_metadata.all? do |key, value|
      wd.metadata[key] == value
    end
  end

  def log_progress(stats)
    Rails.logger.info "[MetadataBackfill] Progress: #{stats.inspect}"
  end
end
