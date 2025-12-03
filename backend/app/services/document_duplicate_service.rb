require 'anthropic'

class DocumentDuplicateService
  MODEL = "claude-sonnet-4-20250514"

  class DuplicateError < StandardError; end

  # Find all duplicate documents (same title within same company)
  def self.find_duplicates(company_id: nil)
    scope = CompanyDocument.select(:title, :company_id)
                          .group(:title, :company_id)
                          .having("COUNT(*) > 1")

    scope = scope.where(company_id: company_id) if company_id.present?

    duplicates = []
    scope.each do |dup|
      docs = CompanyDocument.where(title: dup.title, company_id: dup.company_id)
                           .includes(:company)
                           .order(:created_at)
      duplicates << {
        title: dup.title,
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
    documents = CompanyDocument.where(id: document_ids).includes(:company)
    return { error: "No documents found" } if documents.empty?
    return { error: "Need at least 2 documents to compare" } if documents.count < 2

    # Download and compare file contents
    doc_contents = documents.map do |doc|
      {
        id: doc.id,
        title: doc.title,
        folder: doc.folder,
        company: doc.company&.name,
        company_code: doc.company&.code,
        created_at: doc.created_at,
        file_size: doc.file_size,
        ai_status: doc.ai_verification_status,
        onedrive_file_id: doc.onedrive_file_id,
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
    else
      { error: "Unknown action: #{action}" }
    end
  end

  private

  def self.document_summary(doc)
    {
      id: doc.id,
      title: doc.title,
      folder: doc.folder,
      created_at: doc.created_at,
      file_size: doc.file_size,
      ai_verification_status: doc.ai_verification_status,
      onedrive_file_id: doc.onedrive_file_id
    }
  end

  def self.extract_content_preview(doc)
    return nil unless doc.onedrive_file_id.present?

    begin
      credential = OrganizationOneDriveCredential.active_credential
      return nil unless credential

      client = MicrosoftGraphClient.new(credential)
      content = client.download_file(doc.onedrive_file_id)

      # Extract text preview based on file type
      if doc.title&.end_with?('.pdf')
        extract_pdf_preview(content)
      else
        # For other files, just get first 500 chars
        content.to_s.force_encoding('UTF-8').scrub[0..500]
      end
    rescue StandardError => e
      Rails.logger.warn("Could not extract content preview for doc #{doc.id}: #{e.message}")
      nil
    end
  end

  def self.extract_pdf_preview(content)
    Tempfile.create(['doc', '.pdf']) do |file|
      file.binmode
      file.write(content)
      file.rewind

      begin
        reader = PDF::Reader.new(file.path)
        # Get first page text
        first_page = reader.pages.first
        first_page&.text.to_s[0..500]
      rescue StandardError => e
        Rails.logger.warn("PDF extraction failed: #{e.message}")
        nil
      end
    end
  end

  def self.analyze_with_ai(doc_contents)
    api_key = ENV['ANTHROPIC_API_KEY']
    raise DuplicateError, "ANTHROPIC_API_KEY not configured" unless api_key

    client = Anthropic::Client.new(access_token: api_key)

    prompt = build_analysis_prompt(doc_contents)

    response = client.messages(
      parameters: {
        model: MODEL,
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }]
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
        Title: #{d[:title]}
        Company: #{d[:company]} (#{d[:company_code]})
        Folder: #{d[:folder]}
        Created: #{d[:created_at]}
        File Size: #{d[:file_size]} bytes
        AI Status: #{d[:ai_status]}
        OneDrive ID: #{d[:onedrive_file_id]}
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

  # Action implementations
  def self.keep_newest(document_ids)
    docs = CompanyDocument.where(id: document_ids).order(created_at: :desc)
    keep = docs.first
    delete = docs.offset(1)

    delete_from_sharepoint_and_db(delete.pluck(:id))

    {
      success: true,
      kept: keep.id,
      deleted: delete.pluck(:id),
      message: "Kept newest document (ID: #{keep.id}), deleted #{delete.count} duplicates"
    }
  end

  def self.keep_oldest(document_ids)
    docs = CompanyDocument.where(id: document_ids).order(created_at: :asc)
    keep = docs.first
    delete = docs.offset(1)

    delete_from_sharepoint_and_db(delete.pluck(:id))

    {
      success: true,
      kept: keep.id,
      deleted: delete.pluck(:id),
      message: "Kept oldest document (ID: #{keep.id}), deleted #{delete.count} duplicates"
    }
  end

  def self.keep_verified(document_ids)
    docs = CompanyDocument.where(id: document_ids)
    verified = docs.find_by(ai_verification_status: 'verified')

    unless verified
      return { error: "No verified document found among duplicates" }
    end

    delete = docs.where.not(id: verified.id)
    delete_from_sharepoint_and_db(delete.pluck(:id))

    {
      success: true,
      kept: verified.id,
      deleted: delete.pluck(:id),
      message: "Kept verified document (ID: #{verified.id}), deleted #{delete.count} duplicates"
    }
  end

  def self.rename_document(document_id, new_name)
    doc = CompanyDocument.find(document_id)

    # Rename in SharePoint
    if doc.onedrive_file_id.present?
      credential = OrganizationOneDriveCredential.active_credential
      if credential
        client = MicrosoftGraphClient.new(credential)
        client.rename_file(doc.onedrive_file_id, new_name)
      end
    end

    # Update database
    old_name = doc.title
    doc.update!(title: new_name)

    {
      success: true,
      document_id: doc.id,
      old_name: old_name,
      new_name: new_name,
      message: "Renamed document from '#{old_name}' to '#{new_name}'"
    }
  rescue StandardError => e
    { error: "Rename failed: #{e.message}" }
  end

  def self.merge_documents(document_ids, keep_id)
    docs = CompanyDocument.where(id: document_ids)
    keep = docs.find(keep_id)
    delete = docs.where.not(id: keep_id)

    delete_from_sharepoint_and_db(delete.pluck(:id))

    {
      success: true,
      kept: keep.id,
      deleted: delete.pluck(:id),
      message: "Merged documents, kept ID: #{keep.id}"
    }
  end

  def self.delete_documents(document_ids)
    delete_from_sharepoint_and_db(document_ids)

    {
      success: true,
      deleted: document_ids,
      message: "Deleted #{document_ids.count} documents"
    }
  end

  def self.delete_from_sharepoint_and_db(document_ids)
    CompanyDocument.where(id: document_ids).find_each do |doc|
      # Delete from SharePoint
      if doc.onedrive_file_id.present?
        begin
          credential = OrganizationOneDriveCredential.active_credential
          if credential
            client = MicrosoftGraphClient.new(credential)
            client.delete_file(doc.onedrive_file_id)
            Rails.logger.info("Deleted SharePoint file: #{doc.onedrive_file_id}")
          end
        rescue StandardError => e
          Rails.logger.warn("Could not delete SharePoint file #{doc.onedrive_file_id}: #{e.message}")
          # Continue with database deletion even if SharePoint fails
        end
      end

      # Delete from database
      doc.destroy
    end
  end
end
