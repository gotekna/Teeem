# frozen_string_literal: true

# Scans storage job folders for new/updated plan files
# Creates PlanFolderScan records for files that need processing
#
# ╔═══════════════════════════════════════════════════════════════════╗
# ║  SSoT: Uses DocumentProviderAware for storage abstraction         ║
# ║  Scans Wasabi, SharePoint, or S3 based on StorageConfiguration    ║
# ╚═══════════════════════════════════════════════════════════════════╝
#
class PlanFolderScanJob < ApplicationJob
  include DocumentProviderAware

  queue_as :default

  # SSoT: Use EntityTab.folder_name_for instead of constant
  PLANS_FOLDER_NAME_FALLBACK = "Plan Documents"
  SKIP_FILES = ["All Plans.pdf", "Thumbs.db", ".DS_Store"].freeze

  def plans_folder_name
    # SSoT: Get from EntityTab, fall back to constant
    EntityTab.folder_name_for("job", "plans", PLANS_FOLDER_NAME_FALLBACK)
  end

  def perform(job_id: nil)
    # SSoT: Setup document provider using StorageConfiguration
    begin
      setup_default_provider!
    rescue DocumentProviders::NotConnectedError => e
      Rails.logger.warn "[PlanFolderScanJob] No storage provider configured: #{e.message}"
      return
    end

    jobs_to_scan = if job_id
      Job.where(id: job_id)
    else
      # Scan all active jobs that might have plan folders
      Job.where(status: %w[active in_progress])
    end

    total_found = 0
    total_new = 0

    jobs_to_scan.find_each do |job|
      begin
        found, new_count = scan_job_folder(job)
        total_found += found
        total_new += new_count
      rescue StandardError => e
        Rails.logger.error "[PlanFolderScanJob] Error scanning job #{job.id}: #{e.message}"
      end
    end

    Rails.logger.info "[PlanFolderScanJob] Complete (provider: #{current_provider_type}): scanned #{jobs_to_scan.count} jobs, found #{total_found} files, #{total_new} new"
  end

  private

  def scan_job_folder(job)
    # Build job folder path
    job_folder_path = build_job_folder_path(job)

    # Check if job folder exists
    unless folder_exists_in_provider?(job_folder_path)
      return [0, 0]
    end

    # Look for plans subfolder
    plans_folder_path = "#{job_folder_path}/#{plans_folder_name}"
    unless folder_exists_in_provider?(plans_folder_path)
      return [0, 0]
    end

    # List files in the plans folder
    plan_files = list_folder_in_provider(plans_folder_path)

    found_count = 0
    new_count = 0

    plan_files.each do |file|
      next unless file[:type] == :file  # Skip folders
      next if SKIP_FILES.include?(file[:name])
      next unless file[:name].to_s.downcase.end_with?(".pdf")

      found_count += 1
      file_id = file[:id]
      file_name = file[:name]
      file_modified = file[:modified_at]
      file_size = file[:size]

      # Check if we already have this file
      existing = PlanFolderScan.find_by(storage_file_id: file_id)

      if existing
        # Check if file was modified
        if existing.needs_update?(file_modified)
          existing.update!(
            file_modified_at: file_modified,
            file_size: file_size,
            status: "pending",
            error_message: nil
          )
          new_count += 1
          Rails.logger.info "[PlanFolderScanJob] Updated: #{file_name} (job #{job.id})"
        end
      else
        # New file - create scan record
        PlanFolderScan.create!(
          job: job,
          storage_file_id: file_id,
          file_name: file_name,
          file_modified_at: file_modified,
          file_size: file_size,
          status: "pending"
        )
        new_count += 1
        Rails.logger.info "[PlanFolderScanJob] New: #{file_name} (job #{job.id})"
      end
    end

    [found_count, new_count]
  end

  # SSoT: Use StorageConfiguration.job_path for consistent folder naming
  def build_job_folder_path(job)
    storage_config&.job_path(job.job_code) || "/Jobs/#{job.job_code}"
  end
end
