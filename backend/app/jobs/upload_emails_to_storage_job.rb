# frozen_string_literal: true

# UploadEmailsToStorageJob - Background job to upload emails to current storage provider
#
# Uploads email .eml files from Microsoft Graph API to the configured storage provider
# (Wasabi/S3 or SharePoint). Uses parallel processing for S3-compatible providers.
#
# Usage:
#   UploadEmailsToStorageJob.perform_later(batch_size: 1000)  # Specific batch
#   UploadEmailsToStorageJob.perform_later                    # All missing emails (all tenants)
#   UploadEmailsToStorageJob.perform_later(tenant_id: 2)      # Specific tenant
#
# Progress tracking:
#   - Creates BackgroundJobProgress record for UI monitoring
#   - Visible in File Warehouse under background jobs
#
# FRC (Jan 2026): When no tenant_id specified, processes ALL tenants with pending emails.
# This prevents silent failures when Tenant.first doesn't have emails (e.g., TEEEM vs Tekna).
#
class UploadEmailsToStorageJob < ApplicationJob
  queue_as :low

  def perform(batch_size: nil, tenant_id: nil)
    # If tenant specified, process just that tenant
    if tenant_id
      tenant = Tenant.find(tenant_id)
      process_tenant(tenant, batch_size: batch_size)
    else
      # FRC (Jan 2026): Process ALL tenants with pending emails
      # Previously used Tenant.first which caused silent failures when emails were in different tenant
      process_all_tenants(batch_size: batch_size)
    end
  end

  private

  def process_all_tenants(batch_size:)
    # Find tenants that have emails needing sync (unscoped to see all tenants)
    tenant_ids_with_pending = SyncedEmail.unscoped
      .where(storage_path: [nil, ""])
      .where.not(outlook_id: [nil, ""])
      .distinct
      .pluck(:tenant_id)
      .compact

    if tenant_ids_with_pending.empty?
      Rails.logger.info "[UploadEmailsToStorageJob] No tenants have pending emails"
      return { uploaded: 0, skipped: 0, tenants_processed: 0 }
    end

    Rails.logger.info "[UploadEmailsToStorageJob] Found #{tenant_ids_with_pending.count} tenant(s) with pending emails: #{tenant_ids_with_pending.inspect}"

    results = { uploaded: 0, skipped: 0, errors: [], tenants_processed: 0 }

    tenant_ids_with_pending.each do |tid|
      tenant = Tenant.find(tid)
      result = process_tenant(tenant, batch_size: batch_size)
      results[:uploaded] += result[:uploaded].to_i
      results[:skipped] += result[:skipped].to_i
      results[:errors].concat(result[:errors] || [])
      results[:tenants_processed] += 1
    end

    results
  end

  def process_tenant(tenant, batch_size:)
    progress = nil
    Rails.logger.info "[UploadEmailsToStorageJob] Processing tenant #{tenant.id} (#{tenant.name})"

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
      # FRC (Jan 2026): Must continue even if uploaded=0 (e.g., all skipped due to expired tokens)
      # Otherwise sync stops silently when credentials expire mid-batch
      if batch_size.present? && (result[:uploaded].to_i > 0 || result[:skipped].to_i > 0)
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
    Rails.logger.error "[UploadEmailsToStorageJob] Failed for tenant #{tenant&.id}: #{e.message}"
    Rails.logger.error e.backtrace.first(10).join("\n")
    progress&.fail!(message: e.message)
    # Return error result instead of raising, so other tenants can still be processed
    { uploaded: 0, skipped: 0, errors: [{ tenant_id: tenant&.id, error: e.message }] }
  end
end
