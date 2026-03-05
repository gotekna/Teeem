# frozen_string_literal: true

require "hexapdf"

# =============================================================================
# PlanSetUploadJob - Background processing of plan set uploads
# =============================================================================
# Blob-only storage (Mar 2026): All plans stored via StorageBlob +
# WarehouseDocument. No legacy S3 folder structure created.
#
# Architecture:
# 1. PlanUploadsController uploads PDF to storage staging area
# 2. This job downloads from staging, splits, creates blobs per page
# 3. Progress is tracked in PlanUpload model (frontend polls for updates)
# 4. Staging file is deleted after successful completion
#
# DocumentProviderAware is retained solely for staging file download/cleanup.
# =============================================================================
class PlanSetUploadJob < ApplicationJob
  include DocumentProviderAware

  queue_as :default

  def perform(plan_upload_id)
    @plan_upload = PlanUpload.find(plan_upload_id)
    @job = @plan_upload.job

    Rails.logger.info "[PlanSetUploadJob] Starting upload #{plan_upload_id} for job #{@job.id}"

    begin
      setup_default_provider!
    rescue DocumentProviders::NotConnectedError => e
      @plan_upload.mark_failed!("No storage provider configured: #{e.message}")
      return
    end

    begin
      process_upload!
    rescue => e
      Rails.logger.error "[PlanSetUploadJob] Failed: #{e.message}"
      Rails.logger.error e.backtrace.first(10).join("\n")
      @plan_upload.mark_failed!(e.message)
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

    @plan_upload.mark_completed!

    Rails.logger.info "[PlanSetUploadJob] Completed! Created #{@plan_upload.plans_created.length} plans"
  end

  def download_staging_file!
    Rails.logger.info "[PlanSetUploadJob] Downloading staging file..."

    @file_content = download_from_provider(@plan_upload.staging_file_id)
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

    page_content = extract_single_page(index)

    filename = determine_filename(index)
    @used_filenames.add(filename)

    display_name = filename.sub(/\.pdf$/i, "")
    plan = create_job_plan!(display_name, page_content.bytesize, page_content: page_content)

    @plan_upload.update_progress!(page: page_number, plan_name: display_name)

    Rails.logger.info "[PlanSetUploadJob] Created plan: #{display_name}"
  end

  def create_all_plans_entry!
    existing = @job.job_plans.find_by(display_name: "All Plans")
    if existing
      Rails.logger.info "[PlanSetUploadJob] All Plans entry already exists, skipping"
      return
    end

    Rails.logger.info "[PlanSetUploadJob] Creating All Plans entry..."

    blob = create_storage_blob(@file_content, "All Plans.pdf")

    plan = @job.job_plans.create!(
      job_plan_tab_id: @plan_upload.job_plan_tab_id,
      plan_type_id: nil,
      display_name: "All Plans"
    )

    plan.add_revision!(
      storage_blob: blob,
      file_name: "All Plans.pdf",
      file_size: @file_content.bytesize,
      revision_date: Date.current
    )

    create_warehouse_document(blob, "All Plans.pdf", @file_content.bytesize)

    plans = @plan_upload.plans_created || []
    plans.unshift("All Plans")
    @plan_upload.update!(plans_created: plans)

    Rails.logger.info "[PlanSetUploadJob] Created All Plans entry"
  end

  def cleanup_staging_file!
    return unless @plan_upload.staging_file_id.present?

    begin
      delete_from_provider(@plan_upload.staging_file_id)
      @plan_upload.update!(staging_file_id: nil)
      Rails.logger.info "[PlanSetUploadJob] Deleted staging file"
    rescue => e
      Rails.logger.warn "[PlanSetUploadJob] Failed to delete staging file: #{e.message}"
    end
  end

  def queue_ai_analysis!
    plan_names = (@plan_upload.plans_created || []).reject { |n| n == "All Plans" }

    plan_names.each_with_index do |name, index|
      plan = @job.job_plans.find_by(display_name: name)
      next unless plan

      PlanAiAnalysisJob.set(wait: (index * 3).seconds).perform_later(plan.id)

      if plan.current_revision&.storage_reference.present?
        GeneratePlanThumbnailJob.set(wait: (index * 2).seconds).perform_later(plan.current_revision.id)
      end
    end

    all_plans = @job.job_plans.find_by(display_name: "All Plans")
    if all_plans&.current_revision&.storage_reference.present?
      GeneratePlanThumbnailJob.perform_later(all_plans.current_revision.id)
    end

    Rails.logger.info "[PlanSetUploadJob] Queued AI analysis for #{plan_names.length} plans"
  end

  # ============================================================================
  # Helper Methods
  # ============================================================================

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
    Warehouse::FilenameSanitizer.sanitize(filename)
  end

  def create_storage_blob(content, filename)
    StorageBlob.find_or_create_for_content!(
      content,
      filename: filename,
      content_type: "application/pdf"
    )
  end

  def create_warehouse_document(blob, filename, file_size)
    plans_folder = WarehouseFolder.where(warehouse_type: "job", tab_key: "plans").enabled.first

    WarehouseDocumentCreator.create!(
      filename: filename,
      source_type: "job",
      linkable: @job,
      storage_blob: blob,
      warehouse_folder_id: plans_folder&.id,
      file_size: file_size,
      content_type: "application/pdf"
    )
    blob.increment_reference!
    Rails.logger.info "[PlanSetUploadJob] Created WarehouseDocument for #{filename}"
  rescue => e
    Rails.logger.warn "[PlanSetUploadJob] Failed to create WarehouseDocument for #{filename}: #{e.message}"
  end

  def create_job_plan!(display_name, file_size, page_content: nil)
    existing = @job.job_plans.find_by(display_name: display_name)
    if existing
      Rails.logger.info "[PlanSetUploadJob] Plan '#{display_name}' already exists, skipping"
      return existing
    end

    blob = create_storage_blob(page_content, "#{display_name}.pdf") if page_content

    plan = @job.job_plans.create!(
      job_plan_tab_id: @plan_upload.job_plan_tab_id,
      plan_type_id: nil,
      display_name: display_name
    )

    plan.add_revision!(
      storage_blob: blob,
      file_name: "#{display_name}.pdf",
      file_size: file_size,
      revision_date: Date.current
    )

    create_warehouse_document(blob, "#{display_name}.pdf", file_size) if blob

    plan
  end
end
