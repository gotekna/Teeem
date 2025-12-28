# frozen_string_literal: true

# =============================================================================
# PlanSetUploadJob - Background processing of plan set uploads
# =============================================================================
# This job is THE SSoT for plan PDF processing.
#
# Architecture:
# 1. PlanUploadsController uploads PDF to SharePoint staging folder
# 2. This job downloads from SharePoint, splits, re-uploads pages
# 3. Progress is tracked in PlanUpload model (frontend polls for updates)
# 4. Staging file is deleted after successful completion
# 5. If failed, can be resumed from where it left off
#
# Idempotency:
# - Checks if each plan already exists before creating
# - Safe to retry at any point
#
# =============================================================================
class PlanSetUploadJob < ApplicationJob
  queue_as :default

  def perform(plan_upload_id)
    @plan_upload = PlanUpload.find(plan_upload_id)
    @job = @plan_upload.job

    Rails.logger.info "[PlanSetUploadJob] Starting upload #{plan_upload_id} for job #{@job.id}"

    # Get SharePoint credential
    @credential = MicrosoftCredential.sharepoint_credential
    unless @credential
      @plan_upload.mark_failed!("No active SharePoint credential")
      return
    end

    @client = MicrosoftGraphClient.new(@credential)

    begin
      process_upload!
    rescue => e
      Rails.logger.error "[PlanSetUploadJob] Failed: #{e.message}"
      Rails.logger.error e.backtrace.first(10).join("\n")
      @plan_upload.mark_failed!(e.message)
      raise # Re-raise so SolidQueue knows it failed
    end
  end

  private

  def process_upload!
    # Download staging file from SharePoint
    download_staging_file!

    # Split PDF and count pages
    split_pdf!

    # Process each page (with resume support)
    process_pages!

    # Create "All Plans" entry
    create_all_plans_entry!

    # Clean up staging file
    cleanup_staging_file!

    # Queue AI analysis for each page
    queue_ai_analysis!

    @plan_upload.mark_completed!

    Rails.logger.info "[PlanSetUploadJob] Completed! Created #{@plan_upload.plans_created.length} plans"
  end

  def download_staging_file!
    Rails.logger.info "[PlanSetUploadJob] Downloading staging file..."

    @file_content = @client.download_file(@plan_upload.staging_file_id)
    raise "Failed to download staging file" unless @file_content

    Rails.logger.info "[PlanSetUploadJob] Downloaded #{@file_content.bytesize} bytes"
  end

  def split_pdf!
    Rails.logger.info "[PlanSetUploadJob] Splitting PDF..."

    @doc = HexaPDF::Document.new(io: StringIO.new(@file_content))
    total_pages = @doc.pages.count

    raise "PDF has no pages" if total_pages.zero?

    @plan_upload.mark_splitting!(total_pages: total_pages)

    Rails.logger.info "[PlanSetUploadJob] PDF has #{total_pages} pages"
  end

  def process_pages!
    @plan_upload.mark_processing!

    # Get or create the 04 Plans folder
    @plans_folder_id = get_or_create_plans_folder!

    # Track filenames to avoid duplicates
    @used_filenames = Set.new(["All Plans.pdf"])

    # Resume support: start from where we left off
    start_page = @plan_upload.processed_pages || 0

    (start_page...@doc.pages.count).each do |index|
      process_single_page!(index)
    end
  end

  def process_single_page!(index)
    page_number = index + 1
    Rails.logger.info "[PlanSetUploadJob] Processing page #{page_number} of #{@doc.pages.count}"

    # Extract single page to new PDF
    page_content = extract_single_page(index)

    # Determine filename (simple for now, AI will rename later)
    filename = determine_filename(index)
    @used_filenames.add(filename)

    # Upload to SharePoint
    result = @client.upload_file_content(@plans_folder_id, filename, page_content)

    # Create JobPlan record
    display_name = filename.sub(/\.pdf$/i, "")
    plan = create_job_plan!(display_name, result, page_content.bytesize)

    # Update progress
    @plan_upload.update_progress!(page: page_number, plan_name: display_name)

    Rails.logger.info "[PlanSetUploadJob] Created plan: #{display_name}"
  end

  def create_all_plans_entry!
    # Check if "All Plans" already exists (idempotency)
    existing = @job.job_plans.find_by(display_name: "All Plans")
    if existing
      Rails.logger.info "[PlanSetUploadJob] All Plans entry already exists, skipping"
      return
    end

    Rails.logger.info "[PlanSetUploadJob] Creating All Plans entry..."

    # Upload full PDF as "All Plans.pdf"
    result = @client.upload_file_content(@plans_folder_id, "All Plans.pdf", @file_content)

    plan = @job.job_plans.create!(
      job_plan_tab_id: @plan_upload.job_plan_tab_id,
      plan_type_id: nil,
      display_name: "All Plans"
    )

    plan.add_revision!(
      sharepoint_file_id: result[:id],
      sharepoint_web_url: result[:webUrl] || result[:web_url],
      file_name: "All Plans.pdf",
      file_size: @file_content.bytesize,
      revision_date: Date.today
    )

    # Add to plans_created
    plans = @plan_upload.plans_created || []
    plans.unshift("All Plans") # Add at beginning
    @plan_upload.update!(plans_created: plans)

    Rails.logger.info "[PlanSetUploadJob] Created All Plans entry"
  end

  def cleanup_staging_file!
    return unless @plan_upload.staging_file_id.present?

    begin
      @client.delete("/drives/#{@credential.drive_id}/items/#{@plan_upload.staging_file_id}")
      @plan_upload.update!(staging_file_id: nil)
      Rails.logger.info "[PlanSetUploadJob] Deleted staging file"
    rescue => e
      # Non-fatal - staging file will be cleaned up by scheduled job
      Rails.logger.warn "[PlanSetUploadJob] Failed to delete staging file: #{e.message}"
    end
  end

  def queue_ai_analysis!
    # Get all plan IDs from plans_created (excluding "All Plans")
    plan_names = (@plan_upload.plans_created || []).reject { |n| n == "All Plans" }

    plan_names.each_with_index do |name, index|
      plan = @job.job_plans.find_by(display_name: name)
      next unless plan

      # Stagger AI jobs to avoid rate limits
      PlanAiAnalysisJob.set(wait: (index * 3).seconds).perform_later(plan.id)

      # Queue thumbnail generation for instant preview
      if plan.current_revision&.sharepoint_file_id.present?
        GeneratePlanThumbnailJob.set(wait: (index * 2).seconds).perform_later(plan.current_revision.id)
      end
    end

    # Also generate thumbnail for "All Plans"
    all_plans = @job.job_plans.find_by(display_name: "All Plans")
    if all_plans&.current_revision&.sharepoint_file_id.present?
      GeneratePlanThumbnailJob.perform_later(all_plans.current_revision.id)
    end

    Rails.logger.info "[PlanSetUploadJob] Queued AI analysis for #{plan_names.length} plans"
  end

  # ============================================================================
  # Helper Methods
  # ============================================================================

  def get_or_create_plans_folder!
    # Find the job's folder
    job_folder = @client.find_job_folder(@job)
    raise "Job folder not found in SharePoint" unless job_folder

    # Look for "04 Plans" subfolder
    response = @client.list_folder_items(job_folder["id"])
    items = response["value"] || []
    plans_folder = items.find { |item| item["name"] == "04 Plans" && item["folder"].present? }

    if plans_folder
      plans_folder["id"]
    else
      # Create the 04 Plans folder
      result = @client.create_folder("04 Plans", parent_id: job_folder["id"])
      result["id"]
    end
  end

  def extract_single_page(page_index)
    new_doc = HexaPDF::Document.new
    source_page = @doc.pages[page_index]
    new_doc.pages.add(new_doc.import(source_page))

    output = StringIO.new
    new_doc.write(output)
    output.string
  end

  def determine_filename(page_index)
    page_number = page_index + 1
    page_prefix = format("%02d", page_number)

    # Get short project name from job
    project_name = short_project_name

    base_name = if project_name.present?
      "#{page_prefix} - Page #{page_number} #{project_name}"
    else
      "#{page_prefix} - Page #{page_number}"
    end

    filename = sanitize_filename("#{base_name}.pdf")

    # Handle duplicates
    if @used_filenames.include?(filename)
      counter = 2
      loop do
        new_filename = sanitize_filename("#{base_name} (#{counter}).pdf")
        unless @used_filenames.include?(new_filename)
          filename = new_filename
          break
        end
        counter += 1
      end
    end

    filename
  end

  def short_project_name
    return nil unless @job&.name.present?

    name = @job.name

    # Try to extract "Lot N Street" pattern -> "N Street"
    if match = name.match(/Lot\s+(\d+)[^a-zA-Z]*([A-Za-z]+)/i)
      "#{match[1]} #{match[2]}"
    elsif match = name.match(/^(\d+)\s+([A-Za-z]+)/i)
      "#{match[1]} #{match[2]}"
    else
      nil
    end
  end

  def sanitize_filename(filename)
    SharePoint::FilenameSanitizer.sanitize(filename)
  end

  def create_job_plan!(display_name, sharepoint_result, file_size)
    # Idempotency: check if plan already exists
    existing = @job.job_plans.find_by(display_name: display_name)
    if existing
      Rails.logger.info "[PlanSetUploadJob] Plan '#{display_name}' already exists, skipping"
      return existing
    end

    plan = @job.job_plans.create!(
      job_plan_tab_id: @plan_upload.job_plan_tab_id,
      plan_type_id: nil,
      display_name: display_name
    )

    plan.add_revision!(
      sharepoint_file_id: sharepoint_result[:id],
      sharepoint_web_url: sharepoint_result[:webUrl] || sharepoint_result[:web_url],
      file_name: "#{display_name}.pdf",
      file_size: file_size,
      revision_date: Date.today
    )

    plan
  end
end
