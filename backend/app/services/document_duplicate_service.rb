require "anthropic"

# SSoT: Uses DocumentProviderAware for provider-agnostic storage operations
class DocumentDuplicateService
  include DocumentProviderAware

  MODEL = "claude-sonnet-4-20250514"

  class DuplicateError < StandardError; end

  # Find all duplicate documents (same file_name within same company)
  def self.find_duplicates(company_id: nil)
    scope = CorporateCompanyDocument.select(:file_name, :company_id)
                          .group(:file_name, :company_id)
                          .having("COUNT(*) > 1")

    scope = scope.where(company_id: company_id) if company_id.present?

    duplicates = []
    scope.each do |dup|
      docs = CorporateCompanyDocument.where(file_name: dup.file_name, company_id: dup.company_id)
                           .includes(:corporate_company)
                           .order(:created_at)
      duplicates << {
        file_name: dup.file_name,
        company_id: dup.company_id,
        company_name: docs.first&.company&.name,
        count: docs.count,
        documents: docs.map { |d| document_summary(d) }
      }
    end

    duplicates
  end

  # Analyze a set of duplicate documents and get AI recommendation
  def self.analyze_duplicates(document_ids)
    documents = CorporateCompanyDocument.where(id: document_ids).includes(:corporate_company)
    return { error: "No documents found" } if documents.empty?
    return { error: "Need at least 2 documents to compare" } if documents.count < 2

    # Download and compare file contents
    doc_contents = documents.map do |doc|
      {
        id: doc.id,
        file_name: doc.file_name,
        folder: doc.folder,
        company: doc.company&.name,
        company_code: doc.company&.code,
        created_at: doc.created_at,
        file_size: doc.file_size,
        ai_status: doc.ai_verification_status,
        sharepoint_file_id: doc.sharepoint_file_id,
        content_preview: extract_content_preview(doc)
      }
    end

    # Ask AI to analyze and recommend action
    analyze_with_ai(doc_contents)
  end

  # Execute a recommended action
  def self.execute_action(action, document_ids, options = {})
    case action.to_sym
    when :keep_newest
      keep_newest(document_ids)
    when :keep_oldest
      keep_oldest(document_ids)
    when :keep_verified
      keep_verified(document_ids)
    when :rename
      rename_document(options[:document_id], options[:new_name])
    when :merge
      merge_documents(document_ids, options[:keep_id])
    when :delete_all
      delete_documents(document_ids)
    when :no_action
      { success: true, message: "No action needed - documents are legitimately different" }
    else
      { error: "Unknown action: #{action}" }
    end
  end

  # Confidence thresholds for different actions
  # Destructive actions (delete, merge) need higher confidence
  # Non-destructive actions (rename) can proceed with lower confidence
  CONFIDENCE_THRESHOLDS = {
    destructive: 89,  # delete_all, merge, keep_newest, keep_oldest, keep_verified
    rename: 74        # rename only
  }.freeze

  DESTRUCTIVE_ACTIONS = [ :delete_all, :merge, :keep_newest, :keep_oldest, :keep_verified ].freeze

  # Automatically resolve all duplicates using AI
  # Options:
  #   - company_id: Filter to specific company
  #   - dry_run: If true, only analyze without executing (default: false)
  def self.auto_resolve_all(company_id: nil, dry_run: false)
    duplicates = find_duplicates(company_id: company_id)
    results = []

    duplicates.each do |dup_set|
      document_ids = dup_set[:documents].map { |d| d[:id] }

      Rails.logger.info "[AutoResolve] Analyzing: #{dup_set[:file_name]} (#{dup_set[:count]} copies)"

      begin
        # Get AI recommendation
        analysis = analyze_duplicates(document_ids)

        if analysis[:error]
          results << {
            file_name: dup_set[:file_name],
            company: dup_set[:company_name],
            status: :error,
            error: analysis[:error]
          }
          next
        end

        recommendation = analysis[:recommendation]&.to_sym
        confidence = analysis[:confidence] || 0

        result_entry = {
          file_name: dup_set[:file_name],
          company: dup_set[:company_name],
          document_ids: document_ids,
          recommendation: recommendation,
          confidence: confidence,
          reasoning: analysis[:reasoning],
          is_true_duplicate: analysis[:is_true_duplicate]
        }

        # Skip if no action needed
        if recommendation == :no_action
          result_entry[:status] = :skipped
          result_entry[:message] = "Not true duplicates - different content"
          results << result_entry
          next
        end

        # Determine required confidence based on action type
        required_confidence = if DESTRUCTIVE_ACTIONS.include?(recommendation)
          CONFIDENCE_THRESHOLDS[:destructive]
        else
          CONFIDENCE_THRESHOLDS[:rename]
        end

        # Skip if confidence too low for this action type
        if confidence < required_confidence
          result_entry[:status] = :skipped
          result_entry[:message] = "Confidence too low for #{recommendation} (#{confidence}% < #{required_confidence}% required)"
          results << result_entry
          next
        end

        # Execute unless dry run
        if dry_run
          result_entry[:status] = :dry_run
          result_entry[:would_execute] = recommendation
          result_entry[:required_confidence] = required_confidence
          result_entry[:documents_to_delete] = analysis[:documents_to_delete]
          result_entry[:documents_to_keep] = analysis[:documents_to_keep]
        else
          # Build options for execution
          options = {}
          if recommendation == :rename && analysis[:rename_suggestions].present?
            suggestion = analysis[:rename_suggestions].first
            options[:document_id] = suggestion[:document_id]
            options[:new_name] = suggestion[:new_name]
          elsif recommendation == :merge
            options[:keep_id] = analysis[:documents_to_keep]&.first
          end

          execution_result = execute_action(recommendation, document_ids, options)

          if execution_result[:error]
            result_entry[:status] = :error
            result_entry[:error] = execution_result[:error]
          else
            result_entry[:status] = :resolved
            result_entry[:action_taken] = recommendation
            result_entry[:result] = execution_result
          end
        end

        results << result_entry

      rescue StandardError => e
        Rails.logger.error "[AutoResolve] Error processing #{dup_set[:file_name]}: #{e.message}"
        results << {
          file_name: dup_set[:file_name],
          company: dup_set[:company_name],
          status: :error,
          error: e.message
        }
      end
    end

    # Summary
    summary = {
      total_duplicate_sets: duplicates.count,
      resolved: results.count { |r| r[:status] == :resolved },
      skipped: results.count { |r| r[:status] == :skipped },
      errors: results.count { |r| r[:status] == :error },
      dry_run: results.count { |r| r[:status] == :dry_run },
      thresholds: CONFIDENCE_THRESHOLDS
    }

    { summary: summary, results: results }
  end

  private

  def self.document_summary(doc)
    {
      id: doc.id,
      file_name: doc.file_name,
      folder: doc.folder,
      created_at: doc.created_at,
      file_size: doc.file_size,
      ai_verification_status: doc.ai_verification_status,
      sharepoint_file_id: doc.sharepoint_file_id
    }
  end

  # Extract content preview using provider-agnostic storage
  # SSoT: Uses DocumentStorageService for downloads
  def self.extract_content_preview(doc)
    return nil unless doc.storage_path.present? || doc.sharepoint_file_id.present?

    begin
      service = DocumentStorageService.new
      result = service.download(doc)
      return nil unless result[:success]

      content = result[:content]

      # Extract text preview based on file type
      if doc.file_name&.end_with?(".pdf")
        extract_pdf_preview(content)
      else
        # For other files, just get first 500 chars
        content.to_s.force_encoding("UTF-8").scrub[0..500]
      end
    rescue DocumentProviders::Error => e
      Rails.logger.warn("Could not extract content preview for doc #{doc.id}: #{e.message}")
      nil
    rescue StandardError => e
      Rails.logger.warn("Could not extract content preview for doc #{doc.id}: #{e.message}")
      nil
    end
  end

  # SSoT: Uses PdfTextExtractionService for all PDF text extraction
  def self.extract_pdf_preview(content)
    result = PdfTextExtractionService.extract(
      content,
      max_pages: 1,
      max_chars_per_page: 500,
      join_pages: true
    )

    result[:success] ? result[:text] : nil
  end

  def self.analyze_with_ai(doc_contents)
    api_key = ENV["ANTHROPIC_API_KEY"]
    raise DuplicateError, "ANTHROPIC_API_KEY not configured" unless api_key

    client = Anthropic::Client.new(access_token: api_key)

    prompt = build_analysis_prompt(doc_contents)

    response = client.messages(
      parameters: {
        model: MODEL,
        max_tokens: 1024,
        messages: [ { role: "user", content: prompt } ]
      }
    )

    parse_ai_response(response)
  rescue Anthropic::Error => e
    Rails.logger.error("Anthropic API error: #{e.message}")
    { error: "AI analysis failed: #{e.message}" }
  end

  def self.build_analysis_prompt(doc_contents)
    docs_json = doc_contents.map do |d|
      <<~DOC
        Document ID: #{d[:id]}
        File Name: #{d[:file_name]}
        Company: #{d[:company]} (#{d[:company_code]})
        Folder: #{d[:folder]}
        Created: #{d[:created_at]}
        File Size: #{d[:file_size]} bytes
        AI Status: #{d[:ai_status]}
        OneDrive ID: #{d[:sharepoint_file_id]}
        Content Preview: #{d[:content_preview] || "(could not extract)"}
      DOC
    end.join("\n---\n")

    <<~PROMPT
      Analyze these duplicate documents and recommend the best action.

      ## Documents:
      #{docs_json}

      ## Possible Actions:
      1. **keep_newest** - Keep the most recently created, delete others
      2. **keep_oldest** - Keep the original, delete newer duplicates
      3. **keep_verified** - Keep the one with AI verification status "verified", delete others
      4. **rename** - Rename one or more documents to make them unique (if they're actually different files)
      5. **merge** - If they're the same content but different metadata, merge into one
      6. **delete_all** - If both are outdated/invalid, recommend deleting all
      7. **no_action** - If they belong to different companies or are legitimately different documents

      ## Analysis Required:
      1. Are these TRUE duplicates (same content) or just same filename with different content?
      2. If same content, which one should be kept (newest, oldest, or verified)?
      3. If different content, should they be renamed to be unique?
      4. Consider: file size differences, folder locations, AI verification status

      ## Respond with JSON:
      {
        "recommendation": "keep_newest",
        "confidence": 85,
        "reasoning": "Both files have identical content based on size and preview. The newer version (ID 835) has been verified by AI and should be kept.",
        "documents_to_delete": [829],
        "documents_to_keep": [835],
        "rename_suggestions": null,
        "is_true_duplicate": true
      }

      For rename_suggestions, use format: [{"document_id": 123, "new_name": "New Filename.pdf"}]
    PROMPT
  end

  def self.parse_ai_response(response)
    content = response.dig("content", 0, "text") || response.dig(:content, 0, :text)

    unless content.present?
      return { error: "Empty response from AI" }
    end

    # Extract JSON from response
    json_match = content.match(/\{.*\}/m)
    unless json_match
      return { error: "Could not find JSON in AI response" }
    end

    JSON.parse(json_match[0], symbolize_names: true)
  rescue JSON::ParserError => e
    { error: "Failed to parse AI response: #{e.message}" }
  end

  # Prefix for marking documents for deletion (safety net)
  DELETE_PREFIX = "DELETE - ".freeze

  # Action implementations
  # Note: "delete" actions actually rename with DELETE prefix for safety
  # Users can review and permanently delete later
  def self.keep_newest(document_ids)
    docs = CorporateCompanyDocument.where(id: document_ids).order(created_at: :desc)
    keep = docs.first
    to_mark = docs.offset(1)

    marked = mark_for_deletion(to_mark.pluck(:id))

    {
      success: true,
      kept: keep.id,
      marked_for_deletion: marked,
      message: "Kept newest document (ID: #{keep.id}), marked #{to_mark.count} duplicates for deletion"
    }
  end

  def self.keep_oldest(document_ids)
    docs = CorporateCompanyDocument.where(id: document_ids).order(created_at: :asc)
    keep = docs.first
    to_mark = docs.offset(1)

    marked = mark_for_deletion(to_mark.pluck(:id))

    {
      success: true,
      kept: keep.id,
      marked_for_deletion: marked,
      message: "Kept oldest document (ID: #{keep.id}), marked #{to_mark.count} duplicates for deletion"
    }
  end

  def self.keep_verified(document_ids)
    docs = CorporateCompanyDocument.where(id: document_ids)
    verified = docs.find_by(ai_verification_status: "verified")

    unless verified
      return { error: "No verified document found among duplicates" }
    end

    to_mark = docs.where.not(id: verified.id)
    marked = mark_for_deletion(to_mark.pluck(:id))

    {
      success: true,
      kept: verified.id,
      marked_for_deletion: marked,
      message: "Kept verified document (ID: #{verified.id}), marked #{to_mark.count} duplicates for deletion"
    }
  end

  # Rename document using provider-agnostic storage
  # SSoT: Uses DocumentRenameService for provider-agnostic rename
  def self.rename_document(document_id, new_name)
    doc = CorporateCompanyDocument.find(document_id)

    # Use DocumentRenameService for provider-agnostic rename
    service = DocumentRenameService.new(doc)
    result = service.rename!(new_name)

    if result[:success]
      {
        success: true,
        document_id: doc.id,
        old_name: result[:old_name],
        new_name: result[:new_name],
        message: "Renamed document from '#{result[:old_name]}' to '#{result[:new_name]}'"
      }
    else
      { error: result[:error] || "Rename failed" }
    end
  rescue StandardError => e
    { error: "Rename failed: #{e.message}" }
  end

  # Merge multiple PDFs into one combined PDF
  # SSoT: Uses DocumentStorageService for provider-agnostic operations
  def self.merge_documents(document_ids, keep_id)
    docs = CorporateCompanyDocument.where(id: document_ids).includes(:corporate_company)
    return { error: "No documents found" } if docs.empty?

    # Determine which doc to keep (use provided keep_id or newest)
    keep_doc = keep_id.present? ? docs.find_by(id: keep_id) : docs.order(created_at: :desc).first
    return { error: "Keep document not found" } unless keep_doc

    other_docs = docs.where.not(id: keep_doc.id)
    return { error: "Need at least 2 documents to merge" } if other_docs.empty?

    # Only merge PDFs
    unless docs.all? { |d| d.file_name&.downcase&.end_with?(".pdf") }
      return { error: "Can only merge PDF documents" }
    end

    begin
      storage_service = DocumentStorageService.new

      # Download all PDFs using provider-agnostic service
      pdf_contents = docs.order(:created_at).map do |doc|
        result = storage_service.download(doc)
        unless result[:success]
          raise "Could not download document #{doc.id}: #{result[:error]}"
        end
        {
          id: doc.id,
          file_name: doc.file_name,
          content: result[:content]
        }
      end

      # Merge PDFs using HexaPDF
      merged_pdf = HexaPDF::Document.new

      pdf_contents.each do |pdf_data|
        source_pdf = HexaPDF::Document.new(io: StringIO.new(pdf_data[:content]))
        source_pdf.pages.each do |page|
          merged_pdf.pages.add(merged_pdf.import(page))
        end
      end

      # Write merged PDF to string
      output = StringIO.new
      merged_pdf.write(output)
      merged_content = output.string

      # Get parent folder path from the document being kept
      parent_folder_path = if keep_doc.storage_path.present?
        File.dirname(keep_doc.storage_path)
      elsif keep_doc.respond_to?(:folder) && keep_doc.folder.present?
        storage_config = StorageConfiguration.instance
        base_path = storage_config&.path_for(:corporate) || "Corporate"
        company = keep_doc.corporate_company
        company_folder = company&.document_folder_name || company&.name
        "/#{base_path}/#{company_folder}/#{keep_doc.folder}"
      else
        raise "Cannot determine parent folder for merged document"
      end

      # Delete original keep file first
      storage_service.delete(keep_doc) rescue nil

      # Upload merged file with same name
      instance = new(nil)
      instance.send(:setup_default_provider!)
      result = instance.send(:upload_to_provider, parent_folder_path, merged_content, keep_doc.file_name, content_type: "application/pdf")

      # Update keep document record
      keep_doc.update!(
        sharepoint_file_id: result[:id],
        storage_path: result[:path],
        file_size: merged_content.bytesize,
        ai_verification_status: "pending", # Re-verify merged doc
        ai_analysis_notes: "Merged from #{docs.count} documents: #{docs.pluck(:id).join(', ')}"
      )

      # Delete other documents from storage and database
      other_docs.each do |doc|
        begin
          storage_service.delete(doc)
        rescue StandardError => e
          Rails.logger.warn("Could not delete storage file for doc #{doc.id}: #{e.message}")
        end
        doc.destroy
      end

      {
        success: true,
        kept: keep_doc.id,
        deleted: other_docs.pluck(:id),
        merged_page_count: merged_pdf.pages.count,
        new_file_size: merged_content.bytesize,
        message: "Merged #{docs.count} documents into #{keep_doc.file_name} (#{merged_pdf.pages.count} pages)"
      }

    rescue DocumentProviders::Error => e
      Rails.logger.error("PDF merge storage error: #{e.message}")
      { error: "Merge failed: #{e.message}" }
    rescue StandardError => e
      Rails.logger.error("PDF merge failed: #{e.message}")
      Rails.logger.error(e.backtrace.first(10).join("\n"))
      { error: "Merge failed: #{e.message}" }
    end
  end

  def self.delete_documents(document_ids)
    # Safety net: mark for deletion instead of actually deleting
    marked = mark_for_deletion(document_ids)

    {
      success: true,
      marked_for_deletion: marked,
      message: "Marked #{document_ids.count} documents for deletion (prefixed with '#{DELETE_PREFIX}')"
    }
  end

  # Mark documents for deletion by renaming with DELETE prefix
  # This is a safety net - users can review before permanently deleting
  # SSoT: Uses DocumentRenameService for provider-agnostic rename
  def self.mark_for_deletion(document_ids)
    results = []

    CorporateCompanyDocument.where(id: document_ids).find_each do |doc|
      # Skip if already marked for deletion
      if doc.file_name.start_with?(DELETE_PREFIX)
        results << { id: doc.id, file_name: doc.file_name, status: :already_marked }
        next
      end

      new_name = "#{DELETE_PREFIX}#{doc.file_name}"

      begin
        # Use DocumentRenameService for provider-agnostic rename
        service = DocumentRenameService.new(doc)
        # Bypass skip_rename check for deletion marking
        old_name = doc.file_name

        # Direct rename in storage if identifier exists
        if doc.storage_path.present? || doc.sharepoint_file_id.present?
          instance = new(nil)
          begin
            instance.send(:setup_default_provider!)
            file_identifier = doc.storage_path || doc.sharepoint_file_id
            instance.send(:rename_file_in_provider, file_identifier, new_name)
          rescue DocumentProviders::NotConnectedError
            # Continue with database update even if storage rename fails
          rescue DocumentProviders::Error => e
            Rails.logger.warn("Could not rename in storage for doc #{doc.id}: #{e.message}")
          end
        end

        # Update database
        doc.update!(file_name: new_name)
        Rails.logger.info("Marked for deletion: #{old_name} -> #{new_name}")

        results << { id: doc.id, old_name: old_name, new_name: new_name, status: :marked }
      rescue StandardError => e
        Rails.logger.warn("Could not mark document #{doc.id} for deletion: #{e.message}")
        results << { id: doc.id, file_name: doc.file_name, status: :error, error: e.message }
      end
    end

    results
  end

  # Actually delete documents (for when user confirms deletion of marked files)
  # SSoT: Uses DocumentStorageService for provider-agnostic deletion
  def self.permanently_delete(document_ids)
    storage_service = DocumentStorageService.new

    CorporateCompanyDocument.where(id: document_ids).find_each do |doc|
      # Delete from storage (provider-agnostic)
      if doc.storage_path.present? || doc.sharepoint_file_id.present?
        begin
          storage_service.delete(doc)
          Rails.logger.info("Permanently deleted storage file for doc #{doc.id}")
        rescue DocumentProviders::Error => e
          Rails.logger.warn("Could not delete storage file for doc #{doc.id}: #{e.message}")
          # Continue with database deletion even if storage fails
        rescue StandardError => e
          Rails.logger.warn("Could not delete storage file for doc #{doc.id}: #{e.message}")
          # Continue with database deletion even if storage fails
        end
      end

      # Delete from database
      doc.destroy
    end

    {
      success: true,
      deleted: document_ids,
      message: "Permanently deleted #{document_ids.count} documents"
    }
  end

  # Find all documents marked for deletion
  def self.find_marked_for_deletion(company_id: nil)
    scope = CorporateCompanyDocument.where("file_name LIKE ?", "#{DELETE_PREFIX}%")
    scope = scope.where(company_id: company_id) if company_id.present?
    scope.includes(:corporate_company).map { |d| document_summary(d) }
  end

  # Restore a document marked for deletion (remove DELETE prefix)
  # SSoT: Uses DocumentProviderAware for provider-agnostic rename
  def self.restore_document(document_id)
    doc = CorporateCompanyDocument.find(document_id)

    unless doc.file_name.start_with?(DELETE_PREFIX)
      return { error: "Document is not marked for deletion" }
    end

    new_name = doc.file_name.sub(DELETE_PREFIX, "")

    # Rename in storage (provider-agnostic)
    if doc.storage_path.present? || doc.sharepoint_file_id.present?
      begin
        instance = new(nil)
        instance.send(:setup_default_provider!)
        file_identifier = doc.storage_path || doc.sharepoint_file_id
        instance.send(:rename_file_in_provider, file_identifier, new_name)
      rescue DocumentProviders::NotConnectedError
        # Continue with database update even if storage rename fails
      rescue DocumentProviders::Error => e
        Rails.logger.warn("Could not rename in storage for restore: #{e.message}")
      end
    end

    # Update database
    old_name = doc.file_name
    doc.update!(file_name: new_name)

    {
      success: true,
      document_id: doc.id,
      old_name: old_name,
      new_name: new_name,
      message: "Restored document: #{new_name}"
    }
  rescue StandardError => e
    { error: "Restore failed: #{e.message}" }
  end
end
