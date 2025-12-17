# frozen_string_literal: true

require "hexapdf"

class PlanSetService
  class ProcessingError < StandardError; end

  CLAUDE_MODEL = "claude-sonnet-4-5-20250929"

  def initialize(construction, uploaded_file)
    @construction = construction
    @uploaded_file = uploaded_file
  end

  # Rename existing plans in SharePoint using AI
  # Returns: { success: true, renamed: [...], skipped: [...], errors: [...] }
  def rename_existing_plans!
    credential = OrganizationOneDriveCredential.active_credential
    raise ProcessingError, "No active OneDrive credential" unless credential

    client = MicrosoftGraphClient.new(credential)

    # Find the job folder
    job_folder = client.find_job_folder(@construction)
    raise ProcessingError, "Job folder not found" unless job_folder

    # Find 04 Plans folder
    response = client.list_folder_items(job_folder["id"])
    items = response["value"] || []
    plans_folder = items.find { |item| item["name"] == "04 Plans" && item["folder"].present? }
    raise ProcessingError, "04 Plans folder not found" unless plans_folder

    # List files in 04 Plans
    plan_response = client.list_folder_items(plans_folder["id"])
    plan_files = plan_response["value"] || []
    pdf_files = plan_files.select { |f| f["file"].present? && f["name"]&.end_with?(".pdf") }

    renamed = []
    skipped = []
    errors = []
    used_filenames = Set.new

    # Sort files by name to maintain order (Page 1.pdf, Page 2.pdf, etc.)
    sorted_files = pdf_files.sort_by { |f| f["name"] }

    sorted_files.each_with_index do |file, index|
      file_id = file["id"]
      original_name = file["name"]

      # Skip "All Plans.pdf"
      if original_name == "All Plans.pdf"
        skipped << { id: file_id, name: original_name, reason: "All Plans file" }
        used_filenames.add(original_name)
        next
      end

      # Skip if already has a good name (not "Page N.pdf" - handle URL encoding with + or space)
      unless original_name.match?(/^Page[\s\+]\d+\.pdf$/i)
        skipped << { id: file_id, name: original_name, reason: "Already named" }
        used_filenames.add(original_name)
        next
      end

      # Extract page number from original filename for ordering (handle + or space)
      page_num = original_name.match(/Page[\s\+](\d+)\.pdf/i)&.[](1)&.to_i || (index + 1)

      begin
        Rails.logger.info "[PlanSetService] Renaming #{original_name}..."

        # Download the file content
        content = client.download_file(file_id)
        raise "Failed to download file" unless content

        # Extract sheet info using AI
        sheet_info = extract_sheet_info_with_ai(content, page_num)

        if sheet_info[:sheet_number].blank? && sheet_info[:sheet_name].blank?
          skipped << { id: file_id, name: original_name, reason: "AI could not extract sheet info" }
          used_filenames.add(original_name)
          next
        end

        # Determine new filename (use page_num - 1 as index since determine_filename adds 1)
        new_filename = determine_filename(sheet_info, page_num - 1, used_filenames)
        used_filenames.add(new_filename)

        # Skip if name wouldn't change
        if new_filename == original_name
          skipped << { id: file_id, name: original_name, reason: "Name unchanged" }
          next
        end

        # Rename in SharePoint
        client.rename_file(file_id, new_filename)

        renamed << {
          id: file_id,
          original_name: original_name,
          new_name: new_filename,
          sheet_number: sheet_info[:sheet_number],
          sheet_name: sheet_info[:sheet_name],
          sheet_date: sheet_info[:sheet_date],
          sheet_issue: sheet_info[:sheet_issue]
        }

        Rails.logger.info "[PlanSetService] Renamed #{original_name} -> #{new_filename}"
      rescue StandardError => e
        Rails.logger.error "[PlanSetService] Error renaming #{original_name}: #{e.message}"
        errors << { id: file_id, name: original_name, error: e.message }
      end
    end

    {
      success: true,
      renamed: renamed,
      skipped: skipped,
      errors: errors
    }
  rescue ProcessingError => e
    { success: false, error: e.message }
  rescue StandardError => e
    Rails.logger.error("PlanSetService rename error: #{e.class} - #{e.message}")
    { success: false, error: "Failed to rename plans: #{e.message}" }
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

    # Extract and upload individual pages (with AI-powered naming)
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
    # list_folder_items returns { "value" => [...] } with string keys
    response = client.list_folder_items(job_folder["id"])
    items = response["value"] || []
    plans_folder = items.find { |item| item["name"] == "04 Plans" && item["folder"].present? }

    if plans_folder
      plans_folder["id"]
    else
      # Create the 04 Plans folder
      result = client.create_folder("04 Plans", parent_id: job_folder["id"])
      result["id"]
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
    used_filenames = Set.new([ "All Plans.pdf" ])

    doc.pages.count.times do |index|
      Rails.logger.info "[PlanSetService] Processing page #{index + 1} of #{doc.pages.count}"

      # Extract single page to new PDF
      page_content = extract_single_page(doc, index)

      # Try to get sheet name using AI vision
      sheet_info = extract_sheet_info_with_ai(page_content, index + 1)

      # Determine filename
      filename = determine_filename(sheet_info, index, used_filenames)
      used_filenames.add(filename)

      # Upload to SharePoint
      result = client.upload_file_content(folder_id, filename, page_content)

      pages << {
        page_number: index + 1,
        sheet_number: sheet_info[:sheet_number],
        sheet_name: sheet_info[:sheet_name],
        sheet_date: sheet_info[:sheet_date],
        sheet_issue: sheet_info[:sheet_issue],
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

  # Use Claude vision to extract sheet info from the plan page
  def extract_sheet_info_with_ai(pdf_content, page_number)
    return { sheet_number: nil, sheet_name: nil, sheet_date: nil, sheet_issue: nil } unless ENV["ANTHROPIC_API_KEY"].present?

    begin
      # Convert PDF page to image for vision
      image_data = pdf_to_image(pdf_content)
      return { sheet_number: nil, sheet_name: nil, sheet_date: nil, sheet_issue: nil } unless image_data

      # Call Claude vision API
      result = call_claude_vision(image_data, page_number)
      Rails.logger.info "[PlanSetService] AI extracted: #{result.inspect}"
      result
    rescue StandardError => e
      Rails.logger.error "[PlanSetService] AI extraction failed for page #{page_number}: #{e.message}"
      { sheet_number: nil, sheet_name: nil, sheet_date: nil, sheet_issue: nil }
    end
  end

  # Convert PDF to PNG image for Claude vision
  def pdf_to_image(pdf_content)
    Tempfile.create([ "plan_page", ".pdf" ], binmode: true) do |pdf_file|
      pdf_file.write(pdf_content)
      pdf_file.rewind

      # Use MiniMagick to convert PDF to PNG
      image = MiniMagick::Image.open(pdf_file.path)
      image.format "png"
      image.density 150  # DPI - balance between quality and size
      image.resize "2000x2000>"  # Limit size for API

      image.to_blob
    end
  rescue StandardError => e
    Rails.logger.error "[PlanSetService] PDF to image conversion failed: #{e.message}"
    nil
  end

  def call_claude_vision(image_data, page_number)
    client = Anthropic::Client.new(access_token: ENV["ANTHROPIC_API_KEY"])

    image_base64 = Base64.strict_encode64(image_data)

    response = client.messages(
      parameters: {
        model: CLAUDE_MODEL,
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/png",
                  data: image_base64
                }
              },
              {
                type: "text",
                text: build_sheet_extraction_prompt
              }
            ]
          }
        ]
      }
    )

    parse_sheet_response(response.dig("content", 0, "text"))
  end

  def build_sheet_extraction_prompt
    <<~PROMPT
      This is an architectural/construction plan sheet. Extract the sheet information from the title block (usually in the bottom right corner or right edge).

      Return ONLY valid JSON with no additional text:
      {
        "sheet_number": "The sheet/drawing number (e.g., 'A001', 'S-101', 'E01', 'Sheet 1', '01')",
        "sheet_name": "The sheet title/name (e.g., 'FLOOR PLAN', 'SITE PLAN', 'Perspective 5 Wategos')",
        "sheet_date": "The date on the drawing (e.g., '15/12/2025', '2025-12-15')",
        "sheet_issue": "The issue/revision status (e.g., 'Working Drawings', 'For Construction', 'Preliminary')"
      }

      Important:
      - sheet_number: Look for codes like A001, A-001, S001, S-001, E01, Sheet 1, Drawing 1, 01, 02, etc.
      - sheet_name: Look for the main title/description of what the drawing shows (e.g., "Perspective 5 Wategos", "Ground Floor Plan")
      - sheet_date: Look for "Date:" or a date field in the title block
      - sheet_issue: Look for "Issue:", "Rev:", "Revision:" or status like "Working Drawings", "For Construction"
      - Return null for fields you cannot find
      - Do NOT include the issue/revision in the sheet_name - they are separate fields
    PROMPT
  end

  def parse_sheet_response(text)
    return { sheet_number: nil, sheet_name: nil, sheet_date: nil, sheet_issue: nil } if text.blank?

    # Extract JSON from response
    json_match = text.match(/\{[\s\S]*\}/)
    return { sheet_number: nil, sheet_name: nil, sheet_date: nil, sheet_issue: nil } unless json_match

    result = JSON.parse(json_match[0])
    {
      sheet_number: result["sheet_number"]&.strip,
      sheet_name: result["sheet_name"]&.strip,
      sheet_date: result["sheet_date"]&.strip,
      sheet_issue: result["sheet_issue"]&.strip
    }
  rescue JSON::ParserError => e
    Rails.logger.error "[PlanSetService] JSON parse error: #{e.message}"
    { sheet_number: nil, sheet_name: nil, sheet_date: nil, sheet_issue: nil }
  end

  def determine_filename(sheet_info, page_index, used_filenames)
    # Always prefix with page number to maintain order (01, 02, 03...)
    page_prefix = format("%02d", page_index + 1)

    # Build name from sheet_number or sheet_name
    name_part = if sheet_info[:sheet_number].present? && sheet_info[:sheet_name].present?
      "#{sheet_info[:sheet_number]} - #{sheet_info[:sheet_name]}"
    elsif sheet_info[:sheet_name].present?
      sheet_info[:sheet_name]
    elsif sheet_info[:sheet_number].present?
      sheet_info[:sheet_number]
    else
      nil
    end

    base_name = if name_part.present?
      "#{page_prefix} - #{name_part}"
    else
      "#{page_prefix} - Page #{page_index + 1}"
    end

    filename = sanitize_filename("#{base_name}.pdf")

    # Handle duplicate filenames
    if used_filenames.include?(filename)
      counter = 2
      loop do
        new_filename = sanitize_filename("#{base_name} (#{counter}).pdf")
        unless used_filenames.include?(new_filename)
          filename = new_filename
          break
        end
        counter += 1
      end
    end

    filename
  end

  def sanitize_filename(filename)
    # Remove or replace invalid characters for filenames
    filename
      .gsub(/[<>:"\/\\|?*]/, "_") # Replace invalid Windows/SharePoint chars
      .gsub(/\s+/, " ")           # Normalize whitespace
      .truncate(100, omission: ".pdf") # Limit length
      .strip
  end
end
