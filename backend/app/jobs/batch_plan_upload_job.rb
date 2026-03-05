# frozen_string_literal: true

require "hexapdf"

# =============================================================================
# BatchPlanUploadJob - Background processing of plan set uploads
# =============================================================================
# Blob-only storage (Mar 2026): All plans stored via StorageBlob +
# WarehouseDocument. No legacy S3 folder structure created.
#
# Uses BatchOperation for progress tracking (SSoT for all batch operations).
# =============================================================================
class BatchPlanUploadJob < ApplicationJob
  queue_as :default

  def perform(operation_id)
    @operation = BatchOperation.find_by(id: operation_id)
    return unless @operation
    return unless @operation.operation_type == "plan_upload"

    @job = @operation.job
    return unless @job

    Rails.logger.info "[BatchPlanUploadJob] Starting upload for job #{@job.id}"

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
    Rails.logger.info "[BatchPlanUploadJob] Downloading staging file from blob..."
    @operation.update!(current_step: "Downloading from storage...")

    staging_file_id = @operation.staging_file_id
    raise "No staging file ID" unless staging_file_id.present?

    staging_blob = StorageBlob.find(staging_file_id)
    @file_content = staging_blob.download
    raise "Failed to download staging file from blob #{staging_blob.id}" unless @file_content

    Rails.logger.info "[BatchPlanUploadJob] Downloaded #{@file_content.bytesize} bytes from blob"
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

    page_content = extract_single_page(index)

    filename = determine_filename(index)
    @used_filenames.add(filename)

    display_name = filename.sub(/\.pdf$/i, "")
    create_job_plan!(display_name, page_content.bytesize, page_content: page_content)

    @operation.add_completed_item!(display_name)

    Rails.logger.info "[BatchPlanUploadJob] Created plan: #{display_name}"
  end

  def create_all_plans_entry!
    existing = @job.job_plans.find_by(display_name: "All Plans")
    if existing
      Rails.logger.info "[BatchPlanUploadJob] All Plans entry already exists, skipping"
      return
    end

    Rails.logger.info "[BatchPlanUploadJob] Creating All Plans entry..."
    @operation.update!(current_step: "Creating All Plans entry...")

    blob = create_storage_blob(@file_content, "All Plans.pdf")

    plan = @job.job_plans.create!(
      job_plan_tab_id: job_plan_tab_id,
      plan_type_id: nil,
      display_name: "All Plans",
      is_combined_pdf: true
    )

    plan.add_revision!(
      storage_blob: blob,
      file_name: "All Plans.pdf",
      file_size: @file_content.bytesize,
      revision_date: Date.current
    )

    create_warehouse_document(blob, "All Plans.pdf", @file_content.bytesize)

    items = @operation.items_completed || []
    items.unshift("All Plans")
    @operation.update!(items_completed: items)

    Rails.logger.info "[BatchPlanUploadJob] Created All Plans entry"
  end

  def cleanup_staging_file!
    staging_file_id = @operation.staging_file_id
    return unless staging_file_id.present?

    begin
      blob = StorageBlob.find_by(id: staging_file_id)
      blob&.decrement_reference!
      @operation.staging_file_id = nil
      @operation.save!
      Rails.logger.info "[BatchPlanUploadJob] Cleaned up staging blob"
    rescue => e
      Rails.logger.warn "[BatchPlanUploadJob] Failed to clean staging blob: #{e.message}"
    end
  end

  def queue_ai_analysis!
    items = (@operation.items_completed || []).reject { |n| n == "All Plans" }

    items.each_with_index do |name, index|
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

    Rails.logger.info "[BatchPlanUploadJob] Queued AI analysis for #{items.length} plans"
  end

  # ============================================================================
  # Helper Methods
  # ============================================================================

  def job_plan_tab_id
    @operation.metadata&.dig("job_plan_tab_id") ||
      @job.job_plan_tabs.root_tabs.ordered.first&.id
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
    Rails.logger.info "[BatchPlanUploadJob] Created WarehouseDocument for #{filename}"
  rescue => e
    Rails.logger.warn "[BatchPlanUploadJob] Failed to create WarehouseDocument for #{filename}: #{e.message}"
  end

  def create_job_plan!(display_name, file_size, page_content: nil)
    existing = @job.job_plans.find_by(display_name: display_name)
    if existing
      Rails.logger.info "[BatchPlanUploadJob] Plan '#{display_name}' already exists, skipping"
      return existing
    end

    blob = create_storage_blob(page_content, "#{display_name}.pdf") if page_content

    plan = @job.job_plans.create!(
      job_plan_tab_id: job_plan_tab_id,
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
