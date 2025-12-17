require "hexapdf"

class DocumentSplitService
  class SplitError < StandardError; end
  class FileNotFoundError < SplitError; end
  class InvalidSplitError < SplitError; end

  def initialize(document)
    @document = document
    @company = document.corporate_company
  end

  # Split a document into multiple new documents
  # splits: Array of { pages: "1-2", title: "New filename.pdf", document_type: "ATO Documents", folder: "ATO" }
  def split!(splits)
    validate_splits!(splits)

    # Download the original PDF
    content = download_document

    # Parse the PDF
    source_pdf = HexaPDF::Document.new(io: StringIO.new(content))
    total_pages = source_pdf.pages.count

    # Validate page ranges
    validate_page_ranges!(splits, total_pages)

    created_documents = []

    splits.each do |split_config|
      # Extract pages for this split
      page_range = parse_page_range(split_config[:pages])

      # Create new PDF with extracted pages
      new_pdf_content = extract_pages(source_pdf, page_range)

      # Upload to SharePoint
      new_file_id = upload_to_sharepoint(new_pdf_content, split_config[:title])

      # Create new document record
      new_document = create_document_record(split_config, new_file_id, new_pdf_content.bytesize)

      created_documents << new_document
    end

    # Mark original document as split (or delete it)
    @document.update!(
      ai_verification_status: "split",
      ai_analysis_notes: "Split into #{created_documents.length} documents: #{created_documents.map(&:title).join(', ')}"
    )

    { success: true, documents: created_documents }

  rescue SplitError => e
    { success: false, error: e.message }
  rescue StandardError => e
    Rails.logger.error("DocumentSplitService failed: #{e.class} - #{e.message}")
    Rails.logger.error(e.backtrace.first(10).join("\n"))
    { success: false, error: "Unexpected error: #{e.message}" }
  end

  private

  def validate_splits!(splits)
    raise InvalidSplitError, "No splits provided" if splits.blank?

    splits.each do |split|
      raise InvalidSplitError, "Each split must have pages and title" unless split[:pages].present? && split[:title].present?
    end
  end

  def download_document
    credential = OrganizationOneDriveCredential.active_credential
    raise FileNotFoundError, "No active OneDrive credential" unless credential

    client = MicrosoftGraphClient.new(credential)
    content = client.download_file(@document.sharepoint_file_id)

    raise FileNotFoundError, "Failed to download file content" if content.blank?

    content
  rescue MicrosoftGraphClient::APIError => e
    raise FileNotFoundError, "OneDrive API error: #{e.message}"
  end

  def validate_page_ranges!(splits, total_pages)
    all_pages = Set.new

    splits.each do |split|
      pages = parse_page_range(split[:pages])

      pages.each do |page|
        raise InvalidSplitError, "Page #{page} is out of range (document has #{total_pages} pages)" if page < 1 || page > total_pages
        raise InvalidSplitError, "Page #{page} is assigned to multiple splits" if all_pages.include?(page)
        all_pages.add(page)
      end
    end
  end

  def parse_page_range(range_string)
    # Parse page range string like "1-2" or "3" or "1,3,5"
    pages = []

    range_string.to_s.split(",").each do |part|
      part = part.strip
      if part.include?("-")
        start_page, end_page = part.split("-").map(&:to_i)
        pages.concat((start_page..end_page).to_a)
      else
        pages << part.to_i
      end
    end

    pages.sort.uniq
  end

  def extract_pages(source_pdf, page_numbers)
    # Create a new PDF document
    new_pdf = HexaPDF::Document.new

    # Import each page
    page_numbers.each do |page_num|
      # HexaPDF uses 0-indexed pages
      source_page = source_pdf.pages[page_num - 1]
      new_pdf.pages.add(new_pdf.import(source_page))
    end

    # Write to string
    output = StringIO.new
    new_pdf.write(output)
    output.string
  end

  def upload_to_sharepoint(content, filename)
    credential = OrganizationOneDriveCredential.active_credential
    raise FileNotFoundError, "No active OneDrive credential" unless credential

    client = MicrosoftGraphClient.new(credential)

    # Get parent folder ID from original document
    parent_folder_id = get_parent_folder_id

    # Upload new file
    result = client.upload_file_content(parent_folder_id, filename, content)

    result[:id]
  end

  def get_parent_folder_id
    # Get the folder ID from the original document's path
    credential = OrganizationOneDriveCredential.active_credential
    client = MicrosoftGraphClient.new(credential)

    # Get parent folder from original file
    file_info = client.get_item(@document.sharepoint_file_id)
    file_info.dig("parentReference", "id")
  end

  def create_document_record(split_config, sharepoint_file_id, file_size)
    CorporateCompanyDocument.create!(
      company_id: @document.company_id,
      title: split_config[:title],
      folder: split_config[:folder] || @document.folder,
      document_type: split_config[:document_type],
      source: "split",
      sharepoint_file_id: sharepoint_file_id,
      file_size: file_size,
      financial_years: split_config[:financial_years] || @document.financial_years,
      ref_date: split_config[:ref_date],
      ai_verification_status: "verified", # Auto-verified since user defined the split
      ai_analysis_notes: "Split from #{@document.title}"
    )
  end
end
