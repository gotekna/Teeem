# frozen_string_literal: true

require "hexapdf"

class PlanSetService
  class ProcessingError < StandardError; end

  def initialize(construction, uploaded_file)
    @construction = construction
    @uploaded_file = uploaded_file
  end

  # Process the uploaded PDF plan set
  # Returns: { success: true, all_plans: {...}, pages: [{name, file_id, web_url}] }
  def process!
    validate_file!

    # Read the PDF content
    content = @uploaded_file.read
    @uploaded_file.rewind

    # Parse with HexaPDF
    doc = HexaPDF::Document.new(io: StringIO.new(content))
    page_count = doc.pages.count

    raise ProcessingError, "PDF has no pages" if page_count.zero?

    # Get or create the 04 Plans folder in SharePoint
    plans_folder_id = get_or_create_plans_folder

    # Upload the full PDF as "All Plans.pdf"
    all_plans = upload_full_pdf(content, plans_folder_id)

    # Extract and upload individual pages
    pages = extract_and_upload_pages(doc, plans_folder_id)

    {
      success: true,
      all_plans: all_plans,
      pages: pages,
      total_pages: page_count
    }
  rescue ProcessingError => e
    { success: false, error: e.message }
  rescue HexaPDF::Error => e
    Rails.logger.error("PlanSetService HexaPDF error: #{e.message}")
    { success: false, error: "Invalid PDF file: #{e.message}" }
  rescue StandardError => e
    Rails.logger.error("PlanSetService error: #{e.class} - #{e.message}")
    Rails.logger.error(e.backtrace.first(10).join("\n"))
    { success: false, error: "Failed to process plan set: #{e.message}" }
  end

  private

  def validate_file!
    raise ProcessingError, "No file provided" if @uploaded_file.blank?

    content_type = @uploaded_file.content_type
    unless content_type == "application/pdf" || @uploaded_file.original_filename&.end_with?(".pdf")
      raise ProcessingError, "File must be a PDF"
    end
  end

  def get_or_create_plans_folder
    credential = OrganizationOneDriveCredential.active_credential
    raise ProcessingError, "No active OneDrive credential" unless credential

    client = MicrosoftGraphClient.new(credential)

    # First, find the job's folder
    job_folder = client.find_job_folder(@construction)
    raise ProcessingError, "Job folder not found in SharePoint. Please create folder structure first." unless job_folder

    # Look for "04 Plans" subfolder
    items = client.list_folder_items(job_folder[:id])
    plans_folder = items.find { |item| item[:name] == "04 Plans" && item[:folder].present? }

    if plans_folder
      plans_folder[:id]
    else
      # Create the 04 Plans folder
      result = client.create_folder("04 Plans", parent_id: job_folder[:id])
      result[:id]
    end
  end

  def upload_full_pdf(content, folder_id)
    credential = OrganizationOneDriveCredential.active_credential
    client = MicrosoftGraphClient.new(credential)

    # Upload as "All Plans.pdf"
    result = client.upload_file_content(folder_id, "All Plans.pdf", content)

    {
      name: "All Plans.pdf",
      file_id: result[:id],
      web_url: result[:webUrl] || result[:web_url],
      size: content.bytesize
    }
  end

  def extract_and_upload_pages(doc, folder_id)
    credential = OrganizationOneDriveCredential.active_credential
    client = MicrosoftGraphClient.new(credential)

    pages = []

    doc.pages.count.times do |index|
      # Get the page label (e.g., "A001", "S-101") or fall back to "Page N"
      label = doc.pages.page_label(index)
      filename = if label.present?
        sanitize_filename("#{label}.pdf")
      else
        "Page #{index + 1}.pdf"
      end

      # Extract single page to new PDF
      page_content = extract_single_page(doc, index)

      # Upload to SharePoint
      result = client.upload_file_content(folder_id, filename, page_content)

      pages << {
        page_number: index + 1,
        label: label,
        name: filename,
        file_id: result[:id],
        web_url: result[:webUrl] || result[:web_url],
        size: page_content.bytesize
      }
    end

    pages
  end

  def extract_single_page(source_doc, page_index)
    new_doc = HexaPDF::Document.new
    source_page = source_doc.pages[page_index]
    new_doc.pages.add(new_doc.import(source_page))

    output = StringIO.new
    new_doc.write(output)
    output.string
  end

  def sanitize_filename(filename)
    # Remove or replace invalid characters for filenames
    filename
      .gsub(/[<>:"\/\\|?*]/, "_") # Replace invalid Windows/SharePoint chars
      .gsub(/\s+/, " ")           # Normalize whitespace
      .strip
  end
end
