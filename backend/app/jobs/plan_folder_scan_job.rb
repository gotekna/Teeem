# frozen_string_literal: true

# Scans SharePoint job folders for new/updated plan files
# Creates PlanFolderScan records for files that need processing
class PlanFolderScanJob < ApplicationJob
  queue_as :default

  # SSoT: Use EntityTab.folder_name_for instead of constant
  # Fallback provided for backwards compatibility
  PLANS_FOLDER_NAME_FALLBACK = "Plan Documents"
  SKIP_FILES = ["All Plans.pdf", "Thumbs.db", ".DS_Store"].freeze

  def plans_folder_name
    # SSoT: Get from EntityTab, fall back to constant
    EntityTab.folder_name_for("job", "plans", PLANS_FOLDER_NAME_FALLBACK)
  end

  def perform(job_id: nil)
    credential = MicrosoftCredential.sharepoint_credential
    unless credential
      Rails.logger.warn "[PlanFolderScanJob] No active SharePoint credential"
      return
    end

    client = MicrosoftGraphClient.new(credential)

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
        found, new_count = scan_job_folder(client, job)
        total_found += found
        total_new += new_count
      rescue StandardError => e
        Rails.logger.error "[PlanFolderScanJob] Error scanning job #{job.id}: #{e.message}"
      end
    end

    Rails.logger.info "[PlanFolderScanJob] Complete: scanned #{jobs_to_scan.count} jobs, found #{total_found} files, #{total_new} new"
  end

  private

  def scan_job_folder(client, job)
    # Find the job's folder in SharePoint
    job_folder = client.find_job_folder(job)
    return [0, 0] unless job_folder

    # SSoT: Get plans folder name from EntityTab
    folder_name = plans_folder_name

    # Look for plans subfolder
    response = client.list_folder_items(job_folder["id"])
    items = response["value"] || []
    plans_folder = items.find { |item| item["name"] == folder_name && item["folder"].present? }
    return [0, 0] unless plans_folder

    # List files in the plans folder
    plan_files_response = client.list_folder_items(plans_folder["id"])
    plan_files = plan_files_response["value"] || []

    found_count = 0
    new_count = 0

    plan_files.each do |file|
      next unless file["file"].present?  # Skip folders
      next if SKIP_FILES.include?(file["name"])
      next unless file["name"].to_s.downcase.end_with?(".pdf")

      found_count += 1
      file_id = file["id"]
      file_name = file["name"]
      file_modified = file.dig("lastModifiedDateTime")
      file_size = file.dig("size")

      # Check if we already have this file
      existing = PlanFolderScan.find_by(sharepoint_file_id: file_id)

      if existing
        # Check if file was modified
        if existing.needs_update?(Time.parse(file_modified))
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
          sharepoint_file_id: file_id,
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
end
