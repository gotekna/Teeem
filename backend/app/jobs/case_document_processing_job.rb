# Background job to process documents for a case after creation
# Orchestrates:
# 1. Source folder document organization
# 2. Email attachment download
# 3. Duplicate detection and short code generation
# 4. Q&A extraction from emails
class CaseDocumentProcessingJob < ApplicationJob
  queue_as :default

  # Retry on transient failures
  retry_on StandardError, wait: :exponentially_longer, attempts: 3

  def perform(case_id)
    case_record = CaseRecord.find(case_id)

    Rails.logger.info "[CaseDocumentProcessing] Starting for case #{case_id}: #{case_record.title}"

    case_record.update!(document_processing_status: "processing")

    results = {
      organization: nil,
      attachments: nil,
      duplicates: nil,
      qa_extraction: nil,
      completed_at: nil,
      errors: []
    }

    begin
      # Step 1: Process source folder documents (copy/move)
      if case_record.source_folder_paths.present?
        Rails.logger.info "[CaseDocumentProcessing] Step 1: Organizing source folder documents"
        org_service = CaseDocumentOrganizationService.new(case_record)
        results[:organization] = org_service.organize_all
      end

      # Step 2: Download email attachments to filing folder
      if case_record.case_emails.any?
        Rails.logger.info "[CaseDocumentProcessing] Step 2: Downloading email attachments"
        attachment_service = CaseEmailAttachmentService.new(case_record)
        results[:attachments] = attachment_service.download_all
      end

      # Step 3: Detect duplicates and generate short codes
      Rails.logger.info "[CaseDocumentProcessing] Step 3: Processing duplicates and generating short codes"
      duplicate_service = CaseDocumentDuplicateService.new(case_record)
      results[:duplicates] = duplicate_service.process

      # Step 4: Extract Q&A from email threads
      if case_record.case_emails.any?
        Rails.logger.info "[CaseDocumentProcessing] Step 4: Extracting Q&A from emails"
        qa_service = CaseQaExtractionService.new(case_record)
        results[:qa_extraction] = qa_service.extract_all
      end

      results[:completed_at] = Time.current
      case_record.update!(document_processing_status: "completed")

      Rails.logger.info "[CaseDocumentProcessing] Completed successfully for case #{case_id}"

    rescue => e
      results[:errors] << e.message
      case_record.update!(document_processing_status: "failed")

      Rails.logger.error "[CaseDocumentProcessing] Failed for case #{case_id}: #{e.message}"
      Rails.logger.error e.backtrace.first(10).join("\n")

      raise # Re-raise for retry
    end

    results
  end
end
