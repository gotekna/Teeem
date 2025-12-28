# frozen_string_literal: true

require "hexapdf"

# Service for processing multi-page PDF plan sets
# Uploads to SharePoint and extracts individual pages with AI-named files
#
# SSoT: Uses PlanIdentification::AiValidationLayer for AI sheet extraction
#
class PlanSetService
  class ProcessingError < StandardError; end

  def initialize(construction, uploaded_file)
    @construction = construction
    @uploaded_file = uploaded_file
  end

  # Wrapper method without bang for easier shell access
  def rename_existing_plans
    rename_existing_plans!
  end

  # Rename existing plans in SharePoint using AI
  # Returns: { success: true, renamed: [...], skipped: [...], errors: [...] }
  def rename_existing_plans!
    credential = MicrosoftCredential.sharepoint_credential
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

      # Match files that need renaming:
      # - "Page N.pdf" or "Page+N.pdf" (original format)
      # - "NN - ..." (already renamed with page prefix, can be re-renamed)
      page_pattern = original_name.match(/^Page[\s\+](\d+)\.pdf$/i)
      prefix_pattern = original_name.match(/^(\d{2})\s*-\s*.+\.pdf$/i)

      unless page_pattern || prefix_pattern
        skipped << { id: file_id, name: original_name, reason: "Unrecognized format" }
        used_filenames.add(original_name)
        next
      end

      # Extract page number from filename
      page_num = if page_pattern
        page_pattern[1].to_i
      elsif prefix_pattern
        prefix_pattern[1].to_i
      else
        index + 1
      end

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
  # Options:
  #   skip_ai: true - Skip AI extraction (for faster initial upload, run AI later)
  # Returns: { success: true, all_plans: {...}, pages: [{name, file_id, web_url}] }
  def process!(skip_ai: false)
    @skip_ai = skip_ai
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
    credential = MicrosoftCredential.sharepoint_credential
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
    credential = MicrosoftCredential.sharepoint_credential
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
    credential = MicrosoftCredential.sharepoint_credential
    client = MicrosoftGraphClient.new(credential)

    pages = []
    used_filenames = Set.new([ "All Plans.pdf" ])

    doc.pages.count.times do |index|
      Rails.logger.info "[PlanSetService] Processing page #{index + 1} of #{doc.pages.count}#{@skip_ai ? ' (skip AI)' : ''}"

      # Extract single page to new PDF
      page_content = extract_single_page(doc, index)

      # Get sheet name using AI vision (unless skip_ai is true)
      sheet_info = if @skip_ai
        { sheet_number: nil, sheet_name: nil, sheet_date: nil, sheet_issue: nil }
      else
        extract_sheet_info_with_ai(page_content, index + 1)
      end

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
        size: page_content.bytesize,
        needs_ai_analysis: @skip_ai # Flag to indicate AI analysis is pending
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

  # Use AI to extract sheet info from the plan page
  # SSoT: Delegates to PlanIdentification::AiValidationLayer
  def extract_sheet_info_with_ai(pdf_content, page_number)
    result = PlanIdentification::AiValidationLayer.extract(pdf_content, page_number: page_number)

    {
      sheet_number: result.sheet_number,
      sheet_name: result.sheet_name,
      sheet_date: result.sheet_date,
      sheet_issue: result.sheet_issue
    }
  end

  def determine_filename(sheet_info, page_index, used_filenames)
    # Always prefix with page number to maintain order (01, 02, 03...)
    page_prefix = format("%02d", page_index + 1)

    # Get short project name from job (e.g., "5 Wategos" from "Lot 5 (0) Wategos Street Tingalpa 4173 QLD")
    project_name = short_project_name

    # Use sheet_name as the primary name, append project name
    name_part = if sheet_info[:sheet_name].present?
      project_name.present? ? "#{sheet_info[:sheet_name]} #{project_name}" : sheet_info[:sheet_name]
    elsif sheet_info[:sheet_number].present?
      project_name.present? ? "#{sheet_info[:sheet_number]} #{project_name}" : sheet_info[:sheet_number]
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

  # SSoT: Use centralized SharePoint filename sanitization
  # See lib/sharepoint/filename_sanitizer.rb for rules
  def sanitize_filename(filename)
    SharePoint::FilenameSanitizer.sanitize(filename)
  end

  # Extract short project name from job (e.g., "5 Wategos" from "Lot 5 (0) Wategos Street Tingalpa 4173 QLD")
  def short_project_name
    return nil unless @construction&.name.present?

    name = @construction.name

    # Try to extract "Lot N Street" pattern -> "N Street"
    # Example: "Lot 5 (0) Wategos Street Tingalpa 4173 QLD" -> "5 Wategos"
    if match = name.match(/Lot\s+(\d+)[^a-zA-Z]*([A-Za-z]+)/i)
      "#{match[1]} #{match[2]}"
    # Try to extract street number and name
    elsif match = name.match(/^(\d+)\s+([A-Za-z]+)/i)
      "#{match[1]} #{match[2]}"
    else
      nil
    end
  end
end
