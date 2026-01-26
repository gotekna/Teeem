# frozen_string_literal: true

# UploadEmailsToStorageJob - Background job to upload emails to current storage provider
#
# Uploads email .eml files from Microsoft Graph API to the configured storage provider
# (Wasabi/S3 or SharePoint). Uses parallel processing for S3-compatible providers.
#
# Usage:
#   UploadEmailsToStorageJob.perform_later(batch_size: 1000)  # Specific batch
#   UploadEmailsToStorageJob.perform_later                    # All missing emails
#
# Progress tracking:
#   - Creates BackgroundJobProgress record for UI monitoring
#   - Visible in File Warehouse under background jobs
#
class UploadEmailsToStorageJob < ApplicationJob
  queue_as :low

  def perform(batch_size: nil, tenant_id: nil)
    # SSoT: Get tenant - either passed explicitly or use default tenant
    tenant = if tenant_id
      Tenant.find(tenant_id)
    else
      Tenant.first  # Default tenant for single-tenant setup
    end

    unless tenant
      Rails.logger.error "[UploadEmailsToStorageJob] No tenant found"
      return { error: "No tenant found" }
    end

    # Run with tenant context
    ActsAsTenant.with_tenant(tenant) do
      progress = BackgroundJobProgress.start(
        job_type: "email_storage_upload",
        metadata: { batch_size: batch_size, tenant_id: tenant.id }
      )

      Rails.logger.info "[UploadEmailsToStorageJob] Starting with batch_size: #{batch_size || 'all'} for tenant #{tenant.id}"

      service = EmailStorageUploadService.new(progress: progress, tenant: tenant)
      result = service.upload_missing_emails(batch_size: batch_size)

      Rails.logger.info "[UploadEmailsToStorageJob] Completed: uploaded=#{result[:uploaded]}, skipped=#{result[:skipped]}, errors=#{result[:errors]&.count || 0}"

      # Auto-continue: queue next batch if there are more emails to process
      if batch_size.present? && result[:uploaded].to_i > 0
        remaining = SyncedEmail.where(storage_path: nil).count
        if remaining > 0
          Rails.logger.info "[UploadEmailsToStorageJob] #{remaining} emails remaining, queuing next batch in 5 seconds..."
          UploadEmailsToStorageJob.set(wait: 5.seconds).perform_later(batch_size: batch_size, tenant_id: tenant.id)
        else
          Rails.logger.info "[UploadEmailsToStorageJob] All emails migrated!"
        end
      end

      result
    end  # ActsAsTenant.with_tenant
  rescue StandardError => e
    Rails.logger.error "[UploadEmailsToStorageJob] Failed: #{e.message}"
    Rails.logger.error e.backtrace.first(10).join("\n")
    progress&.fail!(message: e.message) if defined?(progress) && progress
    raise
  end
end
