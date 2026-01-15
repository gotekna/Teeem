# frozen_string_literal: true

# Background job to create storage folder structure for a construction/job
#
# ╔═══════════════════════════════════════════════════════════════════╗
# ║  SSoT: Uses DocumentProviderAware for storage abstraction         ║
# ║  Creates folders in Wasabi, SharePoint, or S3                     ║
# ╚═══════════════════════════════════════════════════════════════════╝
#
# This job is automatically enqueued when a new construction is created with
# `create_sharepoint_folders: true` parameter.
#
# The job:
# - Uses the organization's configured storage provider
# - Creates a job-specific folder (e.g., "001 - Project Name")
# - Creates subfolders based on EntityTab hierarchy
# - Updates the construction's storage_folder_status
# - Is idempotent (won't recreate folders if they already exist)
#
# @param construction_id [Integer] The ID of the construction to create folders for
# @param template_id [Integer, nil] DEPRECATED - ignored
class CreateJobFoldersJob < ApplicationJob
  include DocumentProviderAware

  queue_as :default

  def perform(construction_id, template_id = nil)
    construction = Job.find(construction_id)

    # Mark as processing
    construction.update!(storage_folder_status: "processing")

    # SSoT: Setup document provider using StorageConfiguration
    begin
      setup_default_provider!
    rescue DocumentProviders::NotConnectedError => e
      construction.update!(storage_folder_status: "failed")
      Rails.logger.error "[CreateJobFoldersJob] No storage provider configured: #{e.message}"
      return
    end

    begin
      # Build job folder path
      job_folder_path = build_job_folder_path(construction)

      # Check if job folder already exists (idempotent)
      if folder_exists_in_provider?(job_folder_path)
        # Folders already exist, mark as completed
        construction.update!(storage_folder_status: "completed")
        Rails.logger.info "[CreateJobFoldersJob] Folders already exist for Job ##{construction_id}"
        return
      end

      # Create folder structure for this job (SSoT: uses EntityTab hierarchy)
      create_job_folder_structure(construction, job_folder_path)

      # Mark construction as completed
      construction.update!(storage_folder_status: "completed")

      Rails.logger.info "[CreateJobFoldersJob] Succeeded: Created folders for Job ##{construction_id} (provider: #{current_provider_type})"

    rescue DocumentProviders::AuthenticationError => e
      construction.update!(storage_folder_status: "failed")
      Rails.logger.error "[CreateJobFoldersJob] Auth failed for Job ##{construction_id}: #{e.message}"

    rescue DocumentProviders::Error => e
      construction.update!(storage_folder_status: "failed")
      Rails.logger.error "[CreateJobFoldersJob] Provider error for Job ##{construction_id}: #{e.message}"

    rescue StandardError => e
      construction.update!(storage_folder_status: "failed")
      Rails.logger.error "[CreateJobFoldersJob] Failed for Job ##{construction_id}: #{e.message}"
      Rails.logger.error e.backtrace.join("\n")
    end
  end

  private

  # SSoT: Use StorageConfiguration.job_path for consistent folder naming
  def build_job_folder_path(job)
    storage_config&.job_path(job.job_number) || "/Jobs/#{job.job_number}"
  end

  def create_job_folder_structure(job, job_folder_path)
    # Create main job folder
    get_or_create_folder_path(job_folder_path)

    # SSoT: Create subfolders from EntityTab hierarchy
    create_subfolders_from_entity_tabs(job_folder_path)

    Rails.logger.info "[CreateJobFoldersJob] Created folder structure at #{job_folder_path}"
  end

  def create_subfolders_from_entity_tabs(parent_path)
    root_tabs = EntityTab.for_jobs
                         .where(has_storage_folder: true)
                         .enabled
                         .root_tabs
                         .ordered
                         .includes(children: { children: :children })

    root_tabs.each do |tab|
      create_entity_tab_folder_recursive(tab, parent_path)
    end
  end

  def create_entity_tab_folder_recursive(tab, parent_path)
    folder_path = "#{parent_path}/#{tab.display_name}"
    get_or_create_folder_path(folder_path)

    Rails.logger.info "[CreateJobFoldersJob] Created folder: #{folder_path}"

    tab.children.where(has_storage_folder: true).enabled.ordered.each do |child|
      create_entity_tab_folder_recursive(child, folder_path)
    end
  end
end
