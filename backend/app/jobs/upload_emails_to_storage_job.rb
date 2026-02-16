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
# ⚠️ DO NOT SIMPLIFY - Auto-continue loop replaced perform_later chain (Feb 2026)
# ════════════════════════════════════════════
# Why: Chaining perform_later from within a running job would create a second
#      instance while the current one is still executing. DeduplicatableJob
#      (now before_perform) would skip it since the current job is still claimed.
# ❌ WRONG: UploadEmailsToStorageJob.set(wait: 5.seconds).perform_later(...)
#           → DeduplicatableJob sees current job running → skips → chain breaks
# ✅ CORRECT: Loop within same job execution with time limit (10 min max for Heroku)
# ════════════════════════════════════════════
class UploadEmailsToStorageJob < ApplicationJob
  include DeduplicatableJob

  queue_as :default

  # Max runtime before yielding back to the scheduler (Heroku dynos have 30min limit,
  # but we want to leave headroom for other jobs on the low queue)
  MAX_RUNTIME_SECONDS = 10 * 60  # 10 minutes

  def perform(batch_size: nil, tenant_id: nil)
    @started_at = Time.current

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

  def time_remaining?
    (Time.current - @started_at) < MAX_RUNTIME_SECONDS
  end

  def process_all_tenants(batch_size:)
    # Find tenants that have emails needing sync (unscoped to see all tenants)
    # SSoT: Match EmailStorageUploadService filters exactly to avoid false positives
    tenant_ids_with_pending = SyncedEmail.unscoped
      .where(storage_path: [nil, ""])
      .where(storage_email_path: [nil, ""])
      .where.not(outlook_id: [nil, ""])
      .where.not(mailbox_owner_email: [nil, ""])
      .where(content_unavailable: false)
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
      break unless time_remaining?

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

      total_uploaded = 0
      total_skipped = 0
      total_errors = []
      batch_number = 0

      # Loop within same job execution instead of chaining perform_later
      # (DeduplicatableJob blocks chained jobs since current job is still running)
      loop do
        batch_number += 1
        Rails.logger.info "[UploadEmailsToStorageJob] Batch #{batch_number} (batch_size: #{batch_size || 'all'}) for tenant #{tenant.id}"

        service = EmailStorageUploadService.new(progress: progress, tenant: tenant)
        result = service.upload_missing_emails(batch_size: batch_size)

        uploaded = result[:uploaded].to_i
        skipped = result[:skipped].to_i
        errors = result[:errors] || []

        total_uploaded += uploaded
        total_skipped += skipped
        total_errors.concat(errors)

        Rails.logger.info "[UploadEmailsToStorageJob] Batch #{batch_number}: uploaded=#{uploaded}, skipped=#{skipped}, errors=#{errors.count}"

        # Stop conditions:
        # 1. No batch_size → processed everything in one go
        break unless batch_size.present?

        # 2. Nothing was processed (all remaining are unfetchable/missing outlook_id)
        break if uploaded == 0 && skipped == 0

        # 3. Circuit breaker: if no uploads and ALL are errors, stop looping.
        # FRC (Feb 2026): Without this, broken emails loop forever (500 errors/batch,
        # skipped=500 so condition #2 doesn't trigger), consuming memory until R14 crash.
        if uploaded == 0 && errors.count > 0 && errors.count >= skipped
          Rails.logger.warn "[UploadEmailsToStorageJob] Circuit breaker: batch #{batch_number} had #{errors.count} errors and 0 uploads, stopping"
          break
        end

        # 4. Time limit reached
        unless time_remaining?
          Rails.logger.info "[UploadEmailsToStorageJob] Time limit reached (#{MAX_RUNTIME_SECONDS}s), yielding to scheduler"
          break
        end

        # 5. Check if there are actually more processable emails (tenant-scoped, proper filters)
        remaining = SyncedEmail
          .where(storage_path: [nil, ""])
          .where(storage_email_path: [nil, ""])
          .where.not(outlook_id: [nil, ""])
          .where.not(mailbox_owner_email: [nil, ""])
          .where(content_unavailable: false)
          .count

        if remaining == 0
          Rails.logger.info "[UploadEmailsToStorageJob] All processable emails migrated for tenant #{tenant.id}!"
          break
        end

        Rails.logger.info "[UploadEmailsToStorageJob] #{remaining} emails remaining, continuing..."
      end

      Rails.logger.info "[UploadEmailsToStorageJob] Total for tenant #{tenant.id}: uploaded=#{total_uploaded}, skipped=#{total_skipped}, errors=#{total_errors.count}, batches=#{batch_number}"

      { uploaded: total_uploaded, skipped: total_skipped, errors: total_errors }
    end  # ActsAsTenant.with_tenant
  rescue StandardError => e
    Rails.logger.error "[UploadEmailsToStorageJob] Failed for tenant #{tenant&.id}: #{e.message}"
    Rails.logger.error e.backtrace.first(10).join("\n")
    progress&.fail!(message: e.message)
    # Return error result instead of raising, so other tenants can still be processed
    { uploaded: 0, skipped: 0, errors: [{ tenant_id: tenant&.id, error: e.message }] }
  end
end
