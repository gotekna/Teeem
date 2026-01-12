# frozen_string_literal: true

# Background job for reorganizing files when folder path templates change
#
# SSoT: When StorageConfiguration.scope_templates change (via Entity Config UI),
# this job automatically moves files to match the new folder structure.
#
# Usage:
#   FolderTemplateReorganizationJob.perform_later(
#     scope: "corporate",
#     old_template: "{{CompanyCode}}/{{TabName}}",
#     new_template: "{{CompanyGroup}}/{{CompanyCode}}/{{TabName}}"
#   )
#
# Dry Run (preview changes without moving files):
#   FolderTemplateReorganizationJob.perform_later(
#     scope: "corporate",
#     old_template: "...",
#     new_template: "...",
#     dry_run: true
#   )
#
class FolderTemplateReorganizationJob < ApplicationJob
  queue_as :default

  # Retry on storage API errors with exponential backoff
  retry_on MicrosoftGraphClient::APIError, wait: :polynomially_longer, attempts: 5
  retry_on Aws::S3::Errors::ServiceError, wait: :polynomially_longer, attempts: 5 if defined?(Aws::S3::Errors::ServiceError)

  def perform(scope:, old_template:, new_template:, dry_run: false)
    Rails.logger.info "[FolderReorg] Starting job for scope '#{scope}'"
    Rails.logger.info "[FolderReorg] Template change: '#{old_template}' -> '#{new_template}'"
    Rails.logger.info "[FolderReorg] Dry run: #{dry_run}"

    # Skip if templates are identical
    if old_template == new_template
      Rails.logger.info "[FolderReorg] Templates are identical, skipping"
      return { success: true, skipped: true, reason: "Templates are identical" }
    end

    # Create progress tracker
    progress = BackgroundJobProgress.start(
      job_type: "folder_reorganization",
      scope: scope,
      metadata: {
        old_template: old_template,
        new_template: new_template,
        dry_run: dry_run
      }
    )

    Rails.logger.info "[FolderReorg] Created progress tracker: #{progress.job_id}"

    service = FolderTemplateReorganizationService.new(
      scope: scope,
      old_template: old_template,
      new_template: new_template,
      dry_run: dry_run,
      progress: progress
    )

    result = service.execute

    if result[:success]
      Rails.logger.info "[FolderReorg] Complete: #{result[:stats].inspect}"
    else
      Rails.logger.error "[FolderReorg] Failed: #{result[:error]}"
    end

    result
  end
end
