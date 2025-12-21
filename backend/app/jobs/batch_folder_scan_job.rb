# frozen_string_literal: true

# =============================================================================
# BatchFolderScanJob - Scan SharePoint folders for new plan files
# =============================================================================
# Uses BatchOperation for progress tracking (SSoT for all batch operations).
#
# This job scans SharePoint folders for each job looking for new plan files
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
  queue_as :default

  def perform(operation_id)
    @operation = BatchOperation.find_by(id: operation_id)
    return unless @operation
    return unless @operation.operation_type == "folder_scan"

    Rails.logger.info "[BatchFolderScanJob] Starting folder scan"

    # Get jobs that have SharePoint folders configured
    jobs = Job.where.not(sharepoint_folder_id: nil).order(:name)

    @operation.start_processing!(total: jobs.count)

    jobs.each_with_index do |job, index|
      scan_job_folder!(job, index)
    rescue => e
      Rails.logger.error "[BatchFolderScanJob] Error scanning job #{job.id}: #{e.message}"
      @operation.add_error!(item: job.name, message: e.message)
    end

    @operation.mark_completed!
    Rails.logger.info "[BatchFolderScanJob] Completed folder scan. Found #{@operation.files_found_count} files."
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

    # Get SharePoint credential
    credential = OrganizationSharePointCredential.active_credential
    return unless credential

    client = MicrosoftGraphClient.new(credential)

    # Look for plans folder within job folder
    plans_folder_path = "#{job.sharepoint_folder_id}/Plans"

    begin
      # List files in the plans folder
      files = client.list_folder_contents(plans_folder_path)

      # Filter for PDFs that haven't been processed
      new_files = files.select do |file|
        file["name"]&.ends_with?(".pdf") &&
          !already_processed?(job, file["id"])
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
    rescue => e
      Rails.logger.warn "[BatchFolderScanJob] Could not access plans folder for #{job.name}: #{e.message}"
    end
  end

  def already_processed?(job, sharepoint_file_id)
    # Check if this file has already been imported as a plan
    job.job_plans.joins(:current_revision)
       .where(job_plan_revisions: { sharepoint_file_id: sharepoint_file_id })
       .exists?
  end

  def record_pending_file!(job, file)
    # TODO: Create PendingScanFile record for later processing
    # This will be picked up by BatchFolderProcessJob
    Rails.logger.info "[BatchFolderScanJob] Recording pending file: #{file['name']} for #{job.name}"
  end
end
