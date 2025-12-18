# frozen_string_literal: true

# Processes a single scanned plan file
# Downloads from SharePoint, runs AI identification, creates JobPlan
class PlanFolderProcessJob < ApplicationJob
  queue_as :default

  def perform(scan_id)
    scan = PlanFolderScan.find_by(id: scan_id)
    return unless scan
    return unless scan.status.in?(%w[pending error])

    scan.start_processing!

    begin
      job = scan.job
      credential = OrganizationSharePointCredential.active_credential
      raise "No active SharePoint credential" unless credential

      client = MicrosoftGraphClient.new(credential)

      # Download the file
      content = client.download_file(scan.sharepoint_file_id)
      raise "Failed to download file" unless content

      # Run AI identification
      result = PlanIdentification::PlanIdentificationService.identify(content, job)

      # Ensure job has plan tabs
      PlanCategory.create_tabs_for_job(job) unless job.job_plan_tabs.exists?

      # Check for duplicate plan type
      variant_suffix = nil
      if result.plan_type.present?
        variant_suffix = PlanIdentification::PlanIdentificationService.find_variant_suffix(
          job,
          result.plan_type.id
        )
      end

      # Create the job plan
      job_plan = job.job_plans.create!(
        plan_type_id: result.plan_type&.id,
        job_plan_tab_id: result.job_plan_tab&.id || job.job_plan_tabs.first&.id,
        variant_suffix: variant_suffix,
        display_name: result.display_name || scan.file_name.gsub(/\.pdf$/i, "")
      )

      # Get file metadata for revision
      file_info = client.get_file_metadata(scan.sharepoint_file_id)
      web_url = file_info&.dig("webUrl")

      # Create the revision with the SharePoint file link
      job_plan.add_revision!(
        sharepoint_file_id: scan.sharepoint_file_id,
        sharepoint_web_url: web_url,
        file_name: scan.file_name,
        file_size: scan.file_size,
        revision_date: scan.file_modified_at&.to_date || Date.current
      )

      # Mark scan as processed
      scan.mark_processed!(job_plan)

      Rails.logger.info(
        "[PlanFolderProcessJob] Processed #{scan.file_name} -> " \
        "#{job_plan.computed_display_name} (confidence: #{result.confidence}%)"
      )

    rescue StandardError => e
      Rails.logger.error "[PlanFolderProcessJob] Error processing scan #{scan_id}: #{e.message}"
      scan.mark_error!(e.message)
    end
  end
end
