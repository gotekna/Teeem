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

    service = FolderTemplateReorganizationService.new(
      scope: scope,
      old_template: old_template,
      new_template: new_template,
      dry_run: dry_run
    )

    result = service.execute

    if result[:success]
      Rails.logger.info "[FolderReorg] Complete: #{result[:stats].inspect}"

      # Create notification if files were moved
      if result[:stats][:moved] > 0 && !dry_run
        create_completion_notification(scope, result[:stats])
      end
    else
      Rails.logger.error "[FolderReorg] Failed: #{result[:error]}"
    end

    result
  end

  private

  def create_completion_notification(scope, stats)
    # Create a system notification about the reorganization
    SystemNotification.create(
      title: "Folder Reorganization Complete",
      message: "Reorganized #{stats[:moved]} files in #{scope} scope. #{stats[:errors].count} errors.",
      notification_type: "system",
      severity: stats[:errors].any? ? "warning" : "info",
      data: { scope: scope, stats: stats }
    ) rescue nil
  end
end
