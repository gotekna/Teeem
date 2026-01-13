# frozen_string_literal: true

# =============================================================================
# BatchPlanUploadJob - Background processing of plan set uploads
# =============================================================================
# ╔═══════════════════════════════════════════════════════════════════╗
# ║  SSoT: Uses DocumentProviderAware for storage abstraction         ║
# ║  Uploads to Wasabi, SharePoint, or S3 based on StorageConfiguration║
# ╚═══════════════════════════════════════════════════════════════════╝
#
# Uses BatchOperation for progress tracking (SSoT for all batch operations).
#
# This job handles the complete plan upload workflow:
# 1. Downloads staged PDF from storage
# 2. Splits PDF into individual pages
# 3. Uploads each page to job's Plans folder
# 4. Creates JobPlan records for each page
# 5. Queues AI analysis for identification
#
# Progress tracking via BatchOperation:
# - total_items: number of pages in PDF
# - processed_items: pages processed so far
# - current_item_name: current page being processed
# - items_completed: plan names created
# =============================================================================
class BatchPlanUploadJob < ApplicationJob
  include DocumentProviderAware

  queue_as :default

  def perform(operation_id)
    @operation = BatchOperation.find_by(id: operation_id)
    return unless @operation
    return unless @operation.operation_type == "plan_upload"

    @job = @operation.job
    return unless @job

    Rails.logger.info "[BatchPlanUploadJob] Starting upload for job #{@job.id}"

    # SSoT: Setup document provider using StorageConfiguration
    begin
      setup_default_provider!
    rescue DocumentProviders::NotConnectedError => e
      @operation.mark_failed!("No storage provider configured: #{e.message}")
      return
    end

    begin
      process_upload!
    rescue => e
      Rails.logger.error "[BatchPlanUploadJob] Failed: #{e.message}"
      Rails.logger.error e.backtrace.first(10).join("\n")
      @operation.mark_failed!(e.message)
      raise
    end
  end

  private

  def process_upload!
    download_staging_file!
    split_pdf!
    process_pages!
    create_all_plans_entry!
    cleanup_staging_file!
    queue_ai_analysis!

    @operation.mark_completed!
    Rails.logger.info "[BatchPlanUploadJob] Completed! Created #{(@operation.items_completed || []).length} plans"
  end

  def download_staging_file!
    Rails.logger.info "[BatchPlanUploadJob] Downloading staging file..."
    @operation.update!(current_step: "Downloading from storage...")

    staging_file_id = @operation.staging_file_id
    raise "No staging file ID" unless staging_file_id.present?

    @file_content = download_from_provider(staging_file_id)
    raise "Failed to download staging file" unless @file_content

    Rails.logger.info "[BatchPlanUploadJob] Downloaded #{@file_content.bytesize} bytes (provider: #{current_provider_type})"
  end

  def split_pdf!
    Rails.logger.info "[BatchPlanUploadJob] Splitting PDF..."
    @operation.update!(current_step: "Splitting PDF...")

    @doc = HexaPDF::Document.new(io: StringIO.new(@file_content))
    total_pages = @doc.pages.count

    raise "PDF has no pages" if total_pages.zero?

    @operation.start_processing!(total: total_pages)
    Rails.logger.info "[BatchPlanUploadJob] PDF has #{total_pages} pages"
  end

  def process_pages!
    @plans_folder_id = get_or_create_plans_folder!
    @used_filenames = Set.new(["All Plans.pdf"])

    @doc.pages.count.times do |index|
      process_single_page!(index)
    end
  end

  def process_single_page!(index)
    page_number = index + 1
    Rails.logger.info "[BatchPlanUploadJob] Processing page #{page_number} of #{@doc.pages.count}"

    @operation.update_progress!(
      processed: index,
      current_name: "Page #{page_number}"
    )

    # Extract single page to new PDF
    page_content = extract_single_page(index)

    # Determine filename
    filename = determine_filename(index)
    @used_filenames.add(filename)

    # Upload to storage
    result = upload_to_provider(
      @plans_folder_id,
      filename,
      page_content,
      content_type: "application/pdf"
    )

    # Create JobPlan record
    display_name = filename.sub(/\.pdf$/i, "")
    create_job_plan!(display_name, result, page_content.bytesize)

    # Track completed item
    @operation.add_completed_item!(display_name)

    Rails.logger.info "[BatchPlanUploadJob] Created plan: #{display_name}"
  end

  def create_all_plans_entry!
    # Check if "All Plans" already exists
    existing = @job.job_plans.find_by(display_name: "All Plans")
    if existing
      Rails.logger.info "[BatchPlanUploadJob] All Plans entry already exists, skipping"
      return
    end

    Rails.logger.info "[BatchPlanUploadJob] Creating All Plans entry..."
    @operation.update!(current_step: "Creating All Plans entry...")

    result = upload_to_provider(
      @plans_folder_id,
      "All Plans.pdf",
      @file_content,
      content_type: "application/pdf"
    )

    plan = @job.job_plans.create!(
      job_plan_tab_id: job_plan_tab_id,
      plan_type_id: nil,
      display_name: "All Plans",
      is_combined_pdf: true
    )

    plan.add_revision!(
      sharepoint_file_id: result[:id],
      sharepoint_web_url: result[:webUrl] || result[:web_url],
      file_name: "All Plans.pdf",
      file_size: @file_content.bytesize,
      revision_date: Date.today
    )

    # Add at beginning of items_completed
    items = @operation.items_completed || []
    items.unshift("All Plans")
    @operation.update!(items_completed: items)

    Rails.logger.info "[BatchPlanUploadJob] Created All Plans entry"
  end

  def cleanup_staging_file!
    staging_file_id = @operation.staging_file_id
    return unless staging_file_id.present?

    begin
      delete_from_provider(staging_file_id)
      @operation.staging_file_id = nil
      @operation.save!
      Rails.logger.info "[BatchPlanUploadJob] Deleted staging file"
    rescue DocumentProviders::Error => e
      Rails.logger.warn "[BatchPlanUploadJob] Failed to delete staging file: #{e.message}"
    rescue => e
      Rails.logger.warn "[BatchPlanUploadJob] Failed to delete staging file: #{e.message}"
    end
  end

  def queue_ai_analysis!
    items = (@operation.items_completed || []).reject { |n| n == "All Plans" }

    items.each_with_index do |name, index|
      plan = @job.job_plans.find_by(display_name: name)
      next unless plan

      PlanAiAnalysisJob.set(wait: (index * 3).seconds).perform_later(plan.id)

      if plan.current_revision&.sharepoint_file_id.present?
        GeneratePlanThumbnailJob.set(wait: (index * 2).seconds).perform_later(plan.current_revision.id)
      end
    end

    # Also generate thumbnail for "All Plans"
    all_plans = @job.job_plans.find_by(display_name: "All Plans")
    if all_plans&.current_revision&.sharepoint_file_id.present?
      GeneratePlanThumbnailJob.perform_later(all_plans.current_revision.id)
    end

    Rails.logger.info "[BatchPlanUploadJob] Queued AI analysis for #{items.length} plans"
  end

  # ============================================================================
  # Helper Methods
  # ============================================================================

  def job_plan_tab_id
    @operation.metadata&.dig("job_plan_tab_id") ||
      @job.job_plan_tabs.root_tabs.ordered.first&.id
  end

  def get_or_create_plans_folder!
    # SSoT: Use DocumentProviderAware to get/create job folder path
    job_folder_path = get_or_create_folder_path(:job, @job)
    raise "Job folder not found in storage" unless job_folder_path

    # SSoT: Get plans folder name from EntityTab
    plans_folder_name = EntityTab.folder_name_for("job", "plans", "04 Plans")

    # Get or create plans subfolder
    plans_folder_path = "#{job_folder_path}/#{plans_folder_name}"

    begin
      # Check if plans folder exists
      unless folder_exists_in_provider?(plans_folder_path)
        create_folder_in_provider(plans_folder_path)
      end

      # Return the path/id for uploads
      plans_folder_path
    rescue DocumentProviders::Error => e
      Rails.logger.error "[BatchPlanUploadJob] Error with plans folder: #{e.message}"
      raise "Failed to access plans folder: #{e.message}"
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

    project_name = short_project_name

    base_name = if project_name.present?
      "#{page_prefix} - Page #{page_number} #{project_name}"
    else
      "#{page_prefix} - Page #{page_number}"
    end

    filename = sanitize_filename("#{base_name}.pdf")

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
    existing = @job.job_plans.find_by(display_name: display_name)
    if existing
      Rails.logger.info "[BatchPlanUploadJob] Plan '#{display_name}' already exists, skipping"
      return existing
    end

    plan = @job.job_plans.create!(
      job_plan_tab_id: job_plan_tab_id,
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
