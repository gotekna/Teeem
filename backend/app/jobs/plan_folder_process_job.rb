# frozen_string_literal: true

# Processes a single scanned plan file
# Downloads from storage, runs AI identification, creates JobPlan
#
# ╔═══════════════════════════════════════════════════════════════════╗
# ║  SSoT: Uses DocumentProviderAware for storage abstraction         ║
# ║  Downloads from Wasabi, SharePoint, or S3                         ║
# ╚═══════════════════════════════════════════════════════════════════╝
#
class PlanFolderProcessJob < ApplicationJob
  include DocumentProviderAware

  queue_as :default

  def perform(scan_id)
    scan = PlanFolderScan.find_by(id: scan_id)
    return unless scan
    return unless scan.status.in?(%w[pending error])

    scan.start_processing!

    begin
      job = scan.job

      # SSoT: Setup document provider using WarehouseProvider
      setup_default_provider!

      # Download the file - SSoT: use storage_reference
      content = download_from_provider(scan.storage_reference)
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

      # Link the AiProcessingLog to the newly created job_plan for correction tracking
      if result.log_id.present?
        AiProcessingLog.where(id: result.log_id).update_all(
          processable_type: "JobPlan",
          processable_id: job_plan.id
        )
      end

      # Get file metadata for revision (try to get URL)
      file_path = scan.storage_reference  # Could be path or ID depending on provider

      # Create the revision with the storage file link
      job_plan.add_revision!(
        storage_file_id: scan.storage_reference,
        storage_web_url: file_path,
        file_name: scan.file_name,
        file_size: scan.file_size,
        revision_date: scan.file_modified_at&.to_date || Date.current
      )

      # Mark scan as processed
      scan.mark_processed!(job_plan)

      Rails.logger.info(
        "[PlanFolderProcessJob] Processed #{scan.file_name} -> " \
        "#{job_plan.computed_display_name} (confidence: #{result.confidence}%, provider: #{current_provider_type})"
      )

    rescue DocumentProviders::NotConnectedError => e
      Rails.logger.error "[PlanFolderProcessJob] No storage provider configured: #{e.message}"
      scan.mark_error!(e.message)
    rescue DocumentProviders::Error => e
      Rails.logger.error "[PlanFolderProcessJob] Storage error: #{e.message}"
      scan.mark_error!(e.message)
    rescue StandardError => e
      Rails.logger.error "[PlanFolderProcessJob] Error processing scan #{scan_id}: #{e.message}"
      scan.mark_error!(e.message)
    end
  end
end
