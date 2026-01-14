# Service to download and organize email attachments for a case
# - Downloads attachments from case emails
# - Checks against existing company_documents (SSoT)
# - Files to case folder organized by date
# - Links to case via case_documents
# SSoT: Uses DocumentProviderAware for provider-agnostic storage operations
class CaseEmailAttachmentService
  include DocumentProviderAware

  attr_reader :case_record, :results

  def initialize(case_record)
    @case_record = case_record
    @results = {
      processed_emails: 0,
      attachments_found: 0,
      linked_existing: 0,
      downloaded_new: 0,
      duplicates_found: 0,
      errors: []
    }
  end

  # Main entry point - process all email attachments
  def download_all
    Rails.logger.info "[CaseEmailAttachment] Starting for case #{case_record.id}"

    case_record.case_emails.includes(:email_warehouse).each do |case_email|
      process_email(case_email)
    end

    Rails.logger.info "[CaseEmailAttachment] Complete: #{@results.inspect}"
    @results
  end

  private

  def process_email(case_email)
    email = case_email.email_warehouse
    return unless email&.has_attachments

    @results[:processed_emails] += 1

    # Get attachments from email warehouse (already synced via ActiveStorage)
    if email.files.attached?
      email.files.each do |file|
        process_attachment_from_storage(case_email, file)
      end
    else
      # Try to sync attachments from Outlook if not already done
      sync_and_process_attachments(case_email, email)
    end
  end

  # Process an attachment already in ActiveStorage
  def process_attachment_from_storage(case_email, file)
    @results[:attachments_found] += 1

    # Calculate content hash
    content_hash = nil
    file.open do |temp_file|
      content_hash = Digest::SHA256.file(temp_file.path).hexdigest
    end

    # Check for existing document with same hash
    existing_doc = CorporateCompanyDocument.find_by_content_hash(content_hash)

    if existing_doc
      link_existing_document(existing_doc, case_email, file)
      return
    end

    # Download and save to OneDrive filing folder
    save_attachment_to_filing_folder(case_email, file, content_hash)
  end

  # Sync attachments from Outlook and process
  def sync_and_process_attachments(case_email, email)
    # Skip if no outlook_id
    return unless email.outlook_id.present?

    begin
      # SSoT: Per-user Outlook credentials removed - use org credentials via sync_attachments!
      email.sync_attachments!
      Rails.logger.info "[CaseEmailAttachment] Synced attachments for email #{email.id}"
    rescue => e
      @results[:errors] << { email_id: email.id, error: e.message }
    end
  end

  # Link an existing company_document to the case
  def link_existing_document(company_doc, case_email, file)
    CaseDocument.find_or_create_by!(
      case_id: case_record.id,
      company_document_id: company_doc.id
    ) do |cd|
      cd.source_type = "email_attachment"
      cd.original_location = "Email: #{case_email.email_warehouse.subject}"
      cd.action_taken = "linked"
    end

    @results[:linked_existing] += 1
    Rails.logger.info "[CaseEmailAttachment] Linked existing document: #{company_doc.title}"
  end

  # Save attachment to filing folder (provider-agnostic)
  # SSoT: Uses DocumentProviderAware for uploads
  def save_attachment_to_filing_folder(case_email, file, content_hash)
    # Get filing folder path
    folder_path = get_filing_folder_path
    return unless folder_path

    # Setup provider
    begin
      setup_default_provider!
    rescue DocumentProviders::NotConnectedError => e
      @results[:errors] << { file: file.filename.to_s, error: "Storage not connected: #{e.message}" }
      return
    end

    # Get date-based subfolder
    email_date = case_email.email_warehouse.received_at&.to_date || Date.current
    date_folder_name = email_date.strftime("%Y-%m")
    date_folder_path = "#{folder_path}/#{date_folder_name}"

    # Ensure date folder exists
    get_or_create_folder_path(date_folder_path)

    # Upload file using provider-agnostic method
    file.open do |temp_file|
      result = upload_to_provider(
        date_folder_path,
        File.read(temp_file.path),
        file.filename.to_s,
        content_type: file.content_type
      )

      # Create company_document entry
      company_doc = create_company_document(case_email, file, content_hash, result)

      # Link to case
      CaseDocument.create!(
        case_id: case_record.id,
        company_document_id: company_doc.id,
        source_type: "email_attachment",
        original_location: "Email: #{case_email.email_warehouse.subject}",
        action_taken: "downloaded"
      )

      @results[:downloaded_new] += 1
    end
  rescue DocumentProviders::Error => e
    @results[:errors] << { file: file.filename.to_s, error: e.message }
    Rails.logger.error "[CaseEmailAttachment] Storage error saving attachment: #{e.message}"
  rescue => e
    @results[:errors] << { file: file.filename.to_s, error: e.message }
    Rails.logger.error "[CaseEmailAttachment] Error saving attachment: #{e.message}"
  end

  # Get the filing folder path (provider-agnostic)
  def get_filing_folder_path
    folder_path = case_record.filing_folder_paths.first
    return nil unless folder_path.present?

    # Normalize to path string
    if folder_path.is_a?(Hash)
      folder_path[:path] || folder_path["path"] || folder_path[:id] || folder_path["id"]
    elsif folder_path.is_a?(String)
      folder_path.start_with?("/") ? folder_path : "/#{folder_path}"
    else
      folder_path.to_s
    end
  rescue => e
    Rails.logger.error "[CaseEmailAttachment] Could not resolve filing folder: #{e.message}"
    nil
  end

  # Create company_document for the attachment
  # SSoT: Handles both SharePoint and S3/Wasabi result formats
  def create_company_document(case_email, file, content_hash, storage_result)
    company = case_record.corporate_company || case_record.corporate_companies.first
    email = case_email.email_warehouse

    # Determine document type from mime type
    doc_type = classify_attachment(file)

    # Handle both SharePoint (id/web_url) and S3/Wasabi (path/url) result formats
    storage_file_id = storage_result[:id]
    storage_url = storage_result[:web_url] || storage_result[:url]
    storage_path = storage_result[:path]

    CorporateCompanyDocument.create!(
      company: company,
      title: file.filename.to_s,
      document_type: doc_type,
      file_name: file.filename.to_s,
      file_size: file.byte_size,
      mime_type: file.content_type,  # Required for PDF/image preview
      content_hash: content_hash,
      sharepoint_file_id: storage_file_id,
      sharepoint_download_url: storage_url,
      storage_path: storage_path,
      source: "email_attachment",
      last_modified_at: email.received_at
    )
  end

  # Simple classification based on content type
  def classify_attachment(file)
    content_type = file.content_type

    case content_type
    when "application/pdf"
      "other" # Could be anything - would need AI to classify
    when /spreadsheet|excel/
      "financial"
    when /word|document/
      "other"
    else
      "other"
    end
  end
end
