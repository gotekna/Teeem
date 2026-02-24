# BatchEmailEnrichmentJob - Deferred enrichment for batch-upserted emails
#
# During initial sync, OrgEmailSyncJob uses upsert_all for ~50x speedup.
# This skips per-email callbacks (recipients, rules, task attachment, read status).
# This job runs those deferred enrichments in batches.
#
# Usage:
#   BatchEmailEnrichmentJob.perform_later(email_ids, credential_id)
#
# What it does:
#   1. Batch build_recipients (2 lookups for ALL emails, not 2 per email)
#   2. Per-email: apply_rules, auto_attach_to_task, sync_read_status
#   3. Clears needs_enrichment flag
#   4. Broadcasts new emails via WebSocket
class BatchEmailEnrichmentJob < ApplicationJob
  # FRC (Feb 2026): Moved from :email_sync to :low to prevent R14 on email worker.
  # Root cause: Enrichment + sync competing for 1GB on same dyno (3 threads).
  # Enrichment is CPU/DB-bound (no MS Graph API calls), runs fine on shared-worker.
  queue_as :low

  # Retry on transient DB/network errors
  retry_on ActiveRecord::Deadlocked, wait: :polynomially_longer, attempts: 3
  retry_on ActiveRecord::ConnectionNotEstablished, wait: 5.seconds, attempts: 3

  # Discard if credential is gone
  discard_on ActiveRecord::RecordNotFound

  def perform(email_ids, credential_id)
    credential = MicrosoftCredential.find_by(id: credential_id)
    unless credential
      Rails.logger.warn "[BatchEnrichment] Credential #{credential_id} not found, skipping"
      return
    end

    tenant = credential.tenant
    unless tenant
      Rails.logger.warn "[BatchEnrichment] No tenant for credential #{credential_id}, skipping"
      return
    end

    ActsAsTenant.with_tenant(tenant) do
      emails = SyncedEmail.where(id: email_ids, needs_enrichment: true)
      if emails.empty?
        Rails.logger.info "[BatchEnrichment] No emails need enrichment (#{email_ids.count} IDs checked)"
        return
      end

      Rails.logger.info "[BatchEnrichment] Enriching #{emails.count} emails for credential #{credential_id}"
      enrich_start = Time.current

      # Phase 1: Batch build recipients (2 DB lookups instead of 2 per email)
      batch_build_recipients(emails)

      # Phase 2: Per-email enrichment (rules, task attachment, read status)
      admin_user = find_org_admin(credential)
      enriched = 0
      failed = 0

      emails.find_each do |email|
        begin
          enrich_single_email(email, admin_user)
          enriched += 1
        rescue => e
          Rails.logger.error "[BatchEnrichment] Failed for email #{email.id}: #{e.class}: #{e.message}"
          failed += 1
        end
      end

      # Phase 3: Mark enrichment complete
      SyncedEmail.where(id: email_ids, needs_enrichment: true).update_all(needs_enrichment: false)

      elapsed = (Time.current - enrich_start).round(1)
      Rails.logger.info "[BatchEnrichment] Done: #{enriched} enriched, #{failed} failed in #{elapsed}s"
    end
  end

  private

  def batch_build_recipients(emails)
    # Collect ALL email addresses across all emails
    all_entries = []
    emails.each do |email|
      all_entries << { email_id: email.id, address: email.from_email, type: "from" } if email.from_email.present?
      email.to_emails&.each { |e| all_entries << { email_id: email.id, address: e, type: "to" } }
      email.cc_emails&.each { |e| all_entries << { email_id: email.id, address: e, type: "cc" } }
    end

    return if all_entries.empty?

    # Normalize addresses
    all_entries.each { |e| e[:address] = e[:address].to_s.downcase.strip }
    all_entries.reject! { |e| e[:address].blank? }

    unique_addresses = all_entries.map { |e| e[:address] }.uniq

    # 2 batch lookups (instead of 2 per email)
    users_by_email = User.where("LOWER(email) IN (?)", unique_addresses)
                         .index_by { |u| u.email.downcase }
    contacts_by_email = ContactEmail.where("LOWER(email) IN (?)", unique_addresses)
                                    .includes(:contact)
                                    .each_with_object({}) { |ce, h| h[ce.email.downcase] = ce.contact if ce.contact }

    # Delete existing recipients for all emails (1 query)
    EmailRecipient.where(email_warehouse_id: emails.map(&:id)).delete_all

    # Build all recipients
    now = Time.current
    recipients = all_entries.filter_map do |entry|
      user = users_by_email[entry[:address]]
      contact = contacts_by_email[entry[:address]]
      {
        email_warehouse_id: entry[:email_id],
        email_address: entry[:address],
        recipient_type: entry[:type],
        user_id: user&.id,
        contact_id: contact&.id,
        is_internal: user.present?,
        created_at: now,
        updated_at: now
      }
    end

    EmailRecipient.insert_all(recipients) if recipients.any?
    Rails.logger.info "[BatchEnrichment] Built #{recipients.count} recipients for #{emails.count} emails"
  rescue => e
    Rails.logger.error "[BatchEnrichment] batch_build_recipients failed: #{e.class}: #{e.message}"
  end

  def enrich_single_email(email, admin_user)
    # Apply email rules
    user = email.synced_by_user || admin_user
    if user
      EmailRuleService.new(user).apply_rules(email)
    end

    # Auto-attach to task via conversation_id
    auto_attach_to_task(email, user)

    # Sync read status from the email record to EmailUserState
    sync_read_status(email)
  end

  def auto_attach_to_task(email, user)
    return unless email.conversation_id.present? && user

    # Find tasks that already have emails from the same conversation attached
    task_ids = SmTaskAttachment
      .where(attachable_type: "SyncedEmail")
      .joins("INNER JOIN synced_emails ON synced_emails.id = sm_task_attachments.attachable_id")
      .where("synced_emails.conversation_id = ?", email.conversation_id)
      .where.not("sm_task_attachments.attachable_id = ?", email.id)
      .distinct
      .pluck(:sm_task_id)

    task_ids.each do |task_id|
      # Skip if already attached
      next if SmTaskAttachment.where(
        sm_task_id: task_id,
        attachable_type: "SyncedEmail",
        attachable_id: email.id
      ).exists?

      # Respect user deletions
      next if SmTaskAttachment.was_deleted?(
        sm_task_id: task_id,
        attachable_type: "SyncedEmail",
        attachable_id: email.id
      )

      SmTaskAttachment.create!(
        sm_task_id: task_id,
        attachable: email,
        attachment_type: "email",
        category: "info",
        notes: "Reply in conversation thread (batch enrichment)",
        added_by: user
      )
    end

    # Also check keyword-based matching
    matching_tasks = SmTask.tasks_matching_email(email)
    matching_tasks.each do |task|
      next if SmTaskAttachment.where(
        sm_task_id: task.id,
        attachable_type: "SyncedEmail",
        attachable_id: email.id
      ).exists?

      next if SmTaskAttachment.was_deleted?(
        sm_task_id: task.id,
        attachable_type: "SyncedEmail",
        attachable_id: email.id
      )

      SmTaskAttachment.create!(
        sm_task_id: task.id,
        attachable: email,
        attachment_type: "email",
        category: "info",
        notes: "Matched by keywords: #{task.email_keywords.truncate(50)} (batch enrichment)",
        added_by: user
      )
    end
  rescue => e
    Rails.logger.error "[BatchEnrichment] auto_attach_to_task failed for email #{email.id}: #{e.message}"
  end

  def sync_read_status(email)
    user = email.synced_by_user
    return unless user

    state = EmailUserState.find_or_initialize_by(email_warehouse: email, user: user)
    if state.new_record? || state.is_read != email.is_read
      state.is_read = email.is_read
      state.save!
    end
  rescue => e
    Rails.logger.error "[BatchEnrichment] sync_read_status failed for email #{email.id}: #{e.message}"
  end

  def find_org_admin(credential)
    org = credential.organization
    return nil unless org

    # Find an admin user in the same tenant
    User.with_role("admin").first
  end
end
