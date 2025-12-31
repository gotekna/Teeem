# frozen_string_literal: true

# Service for renaming documents in SharePoint and updating local records
# Part of the unified document standardization system (SSoT: DocumentType.naming_format)
#
# Usage:
#   service = DocumentRenameService.new(job_document)
#   service.rename!("J042 Contract 01-06-2024.pdf")
#
# For batch renames:
#   DocumentRenameService.batch_rename(job_documents, use_ai_names: true)
#
class DocumentRenameService
  class RenameError < StandardError; end

  def initialize(document)
    @document = document
    @credential = MicrosoftCredential.sharepoint_credential
  end

  # Rename a single document
  # @param new_name [String] The new filename
  # @param approved_by [User] Optional user who approved the rename
  # @return [Hash] Result with success status and details
  def rename!(new_name, approved_by: nil)
    raise RenameError, "No SharePoint credential configured" unless @credential
    raise RenameError, "Document has no SharePoint item ID" if @document.sharepoint_item_id.blank?
    raise RenameError, "New name cannot be blank" if new_name.blank?

    # Check if document type should skip renaming (CAD/BIM files)
    if @document.document_type&.skip_rename?
      Rails.logger.info("[DocumentRename] Skipping #{@document.file_name} - document type has skip_rename=true")
      return { success: false, skipped: true, reason: "Document type does not allow renaming" }
    end

    # Preserve file extension if not included in new name
    new_name = ensure_extension(new_name)

    client = MicrosoftGraphClient.new(@credential)
    old_name = @document.file_name

    Rails.logger.info("[DocumentRename] Renaming #{old_name} → #{new_name}")

    # 1. Rename in SharePoint
    client.rename_file(@document.sharepoint_item_id, new_name)

    # 2. Update local record
    @document.update!(
      original_file_name: @document.original_file_name || old_name,  # Preserve first original
      file_name: new_name,
      rename_status: "completed",
      rename_approved_at: Time.current,
      rename_approved_by: approved_by
    )

    { success: true, old_name: old_name, new_name: new_name }

  rescue MicrosoftGraphClient::APIError => e
    Rails.logger.error("[DocumentRename] SharePoint error: #{e.message}")
    @document.update_column(:rename_status, "failed")
    { success: false, error: "SharePoint error: #{e.message}" }
  rescue StandardError => e
    Rails.logger.error("[DocumentRename] Error: #{e.message}")
    { success: false, error: e.message }
  end

  # Rename using the AI-proposed name
  # @param approved_by [User] Optional user who approved the rename
  # @return [Hash] Result with success status
  def rename_to_ai_proposed!(approved_by: nil)
    raise RenameError, "No AI proposed name" if @document.ai_proposed_name.blank?
    rename!(@document.ai_proposed_name, approved_by: approved_by)
  end

  # Check if document needs renaming (current name doesn't match AI proposed)
  def needs_rename?
    return false if @document.ai_proposed_name.blank?
    normalize_name(@document.file_name) != normalize_name(@document.ai_proposed_name)
  end

  # Batch rename multiple documents
  # @param documents [Array<JobDocument>] Documents to rename
  # @param use_ai_names [Boolean] Use ai_proposed_name for each document
  # @param approved_by [User] Optional user who approved the renames
  # @return [Hash] Stats with success/failure counts
  def self.batch_rename(documents, use_ai_names: true, approved_by: nil)
    stats = { total: documents.size, success: 0, failed: 0, skipped: 0, errors: [] }

    documents.each do |doc|
      # Skip documents whose type doesn't allow renaming (CAD/BIM files)
      if doc.document_type&.skip_rename?
        stats[:skipped] += 1
        next
      end

      service = new(doc)

      if use_ai_names
        if doc.ai_proposed_name.blank?
          stats[:skipped] += 1
          next
        end

        result = service.rename_to_ai_proposed!(approved_by: approved_by)
      else
        stats[:skipped] += 1
        next  # Need explicit new_name when not using AI names
      end

      if result[:success]
        stats[:success] += 1
      elsif result[:skipped]
        stats[:skipped] += 1
      else
        stats[:failed] += 1
        stats[:errors] << { document_id: doc.id, error: result[:error] }
      end
    end

    stats
  end

  # Preview what would be renamed (dry run)
  # @param documents [Array<JobDocument>] Documents to check
  # @return [Array<Hash>] Preview of changes
  def self.preview(documents)
    documents.filter_map do |doc|
      next if doc.document_type&.skip_rename?  # Skip CAD/BIM types
      next if doc.ai_proposed_name.blank?
      next if normalize_name(doc.file_name) == normalize_name(doc.ai_proposed_name)

      {
        id: doc.id,
        job_id: doc.job_id,
        current_name: doc.file_name,
        proposed_name: doc.ai_proposed_name,
        confidence: doc.ai_confidence
      }
    end
  end

  private

  def ensure_extension(new_name)
    return new_name if @document.file_extension.blank?

    extension = ".#{@document.file_extension.downcase}"
    return new_name if new_name.downcase.end_with?(extension)

    "#{new_name}#{extension}"
  end

  def self.normalize_name(name)
    return "" if name.blank?
    name.downcase.gsub(/\s+/, " ").strip
  end

  def normalize_name(name)
    self.class.normalize_name(name)
  end
end
