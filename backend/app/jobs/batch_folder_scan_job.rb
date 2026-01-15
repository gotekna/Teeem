# frozen_string_literal: true

# =============================================================================
# BatchFolderScanJob - Scan storage folders for new plan files
# =============================================================================
# ╔═══════════════════════════════════════════════════════════════════╗
# ║  SSoT: Uses DocumentProviderAware for storage abstraction         ║
# ║  Scans Wasabi, SharePoint, or S3 based on StorageConfiguration    ║
# ╚═══════════════════════════════════════════════════════════════════╝
#
# Uses BatchOperation for progress tracking (SSoT for all batch operations).
#
# This job scans storage folders for each job looking for new plan files
# (particularly Revit prints) that haven't been processed yet.
#
# Progress tracking:
# - total_items: number of jobs to scan
# - processed_items: jobs scanned so far
# - current_item_name: job name being scanned
# - metadata.jobs_scanned: list of job names scanned
# - metadata.files_found: total new files found across all jobs
# =============================================================================
class BatchFolderScanJob < ApplicationJob
  include DocumentProviderAware

  queue_as :default

  def perform(operation_id)
    @operation = BatchOperation.find_by(id: operation_id)
    return unless @operation
    return unless @operation.operation_type == "folder_scan"

    Rails.logger.info "[BatchFolderScanJob] Starting folder scan"

    # SSoT: Setup document provider using StorageConfiguration
    begin
      setup_default_provider!
    rescue DocumentProviders::NotConnectedError => e
      @operation.mark_failed!("No storage provider configured: #{e.message}")
      return
    end

    # Get jobs that have storage folders configured
    jobs = Job.where.not(storage_folder_id: nil).order(:name)

    @operation.start_processing!(total: jobs.count)

    jobs.each_with_index do |job, index|
      scan_job_folder!(job, index)
    rescue => e
      Rails.logger.error "[BatchFolderScanJob] Error scanning job #{job.id}: #{e.message}"
      @operation.add_error!(item: job.name, message: e.message)
    end

    @operation.mark_completed!
    Rails.logger.info "[BatchFolderScanJob] Completed folder scan (provider: #{current_provider_type}). Found #{@operation.files_found_count} files."
  rescue => e
    Rails.logger.error "[BatchFolderScanJob] Job failed: #{e.message}"
    @operation&.mark_failed!(e.message)
    raise
  end

  private

  def scan_job_folder!(job, index)
    @operation.update_progress!(
      processed: index,
      current_name: job.name
    )

    # Build job folder path
    job_folder_path = build_job_folder_path(job)
    plans_folder_path = "#{job_folder_path}/Plans"

    begin
      # Check if plans folder exists
      return unless folder_exists_in_provider?(plans_folder_path)

      # List files in the plans folder
      files = list_folder_in_provider(plans_folder_path)

      # Filter for PDFs that haven't been processed
      new_files = files.select do |file|
        file[:name]&.ends_with?(".pdf") &&
          file[:type] == :file &&
          !already_processed?(job, file[:id])
      end

      if new_files.any?
        Rails.logger.info "[BatchFolderScanJob] Found #{new_files.count} new files in #{job.name}"
        @operation.increment_files_found!(new_files.count)

        # Record each new file for later processing
        new_files.each do |file|
          record_pending_file!(job, file)
        end
      end

      @operation.add_scanned_job!(job.name)
    rescue DocumentProviders::NotFoundError => e
      Rails.logger.debug "[BatchFolderScanJob] Plans folder not found for #{job.name}"
    rescue DocumentProviders::Error => e
      Rails.logger.warn "[BatchFolderScanJob] Could not access plans folder for #{job.name}: #{e.message}"
    end
  end

  # SSoT: Use StorageConfiguration.job_path for consistent folder naming
  def build_job_folder_path(job)
    storage_config&.job_path(job.job_code) || "/Jobs/#{job.job_code}"
  end

  def already_processed?(job, storage_file_id)
    # Check if this file has already been imported as a plan
    job.job_plans.joins(:current_revision)
       .where(job_plan_revisions: { sharepoint_file_id: storage_file_id })
       .exists?
  end

  def record_pending_file!(job, file)
    # TODO: Create PendingScanFile record for later processing
    # This will be picked up by BatchFolderProcessJob
    Rails.logger.info "[BatchFolderScanJob] Recording pending file: #{file[:name]} for #{job.name}"
  end
end
