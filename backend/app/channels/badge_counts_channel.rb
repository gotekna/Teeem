# frozen_string_literal: true

# BadgeCountsChannel - Push badge counts to connected users via WebSocket
#
# Replaces 7 polling HTTP endpoints with a single WebSocket channel.
# Broadcast job (BadgeCountsBroadcastJob) runs every 30s and pushes counts
# to all connected users, eliminating ~190 HTTP requests/3min per browser tab.
#
# FRC (Feb 2026): Root cause of R14 memory on Basic web dyno (512MB).
# 289MB boot + 8 polling endpoints every 5-60s per tab = monotonic memory growth.
# Ruby GC doesn't release AR object memory back to OS.
#
# Usage (from backend):
#   BadgeCountsChannel.broadcast_to(user, { type: "badge_counts", counts: {...} })
#   BadgeCountsChannel.broadcast_counts(user)  # Computes and sends
#
class BadgeCountsChannel < ApplicationCable::Channel
  def subscribed
    stream_for current_user
    Rails.logger.info "[BadgeCountsChannel] User #{current_user.id} subscribed"

    # Send initial counts immediately on subscribe
    self.class.broadcast_counts(current_user)
  end

  def unsubscribed
    Rails.logger.info "[BadgeCountsChannel] User #{current_user.id} unsubscribed"
  end

  # Compute and broadcast all badge counts for a user
  def self.broadcast_counts(user)
    counts = compute_counts(user)
    broadcast_to(user, {
      type: "badge_counts",
      counts: counts
    })
  rescue StandardError => e
    Rails.logger.error "[BadgeCountsChannel] Error broadcasting to user #{user.id}: #{e.message}"
  end

  # Compute all 7 badge counts in one method
  # Each count uses the same query as its original HTTP endpoint
  def self.compute_counts(user)
    tenant = user.tenant
    return empty_counts unless tenant

    # Set tenant context for acts_as_tenant scoped queries
    ActsAsTenant.with_tenant(tenant) do
      counts = {}

      # 1. Unread notifications (was: GET /api/v1/notifications/unread_count)
      counts[:unread_notifications] = user.notifications.unread.count rescue 0

      # 2. Unread chat messages (was: GET /api/v1/chat_messages/unread_count)
      counts[:unread_chat_messages] = compute_chat_unread(user) rescue 0

      # 3. Pending job proposals (was: GET /api/v1/email_job_proposals/pending_count)
      tenant_synced_email_ids = SyncedEmail.select(:id)
      counts[:pending_job_proposals] = EmailJobProposal
        .where(email_warehouse_id: tenant_synced_email_ids, status: "pending")
        .count rescue 0

      # 4. Pending case proposals (was: GET /api/v1/email_case_proposals/pending_count)
      counts[:pending_case_proposals] = EmailCaseProposal
        .where(email_warehouse_id: tenant_synced_email_ids, status: "pending")
        .count rescue 0

      # 5. Pending bills (was: GET /api/v1/bill_inbox/stats - pending + errors + awaiting_approval)
      bill_status_counts = BillInbox.group(:status).count rescue {}
      counts[:pending_bills] = (bill_status_counts["pending"] || 0) +
                               (bill_status_counts["error"] || 0) +
                               (bill_status_counts["approval_pending"] || 0)

      # 6. Pending plan scans (was: GET /api/v1/plan_folder_scans/pending_count)
      counts[:pending_plan_scans] = PlanFolderScan.pending.count rescue 0

      # 7. Unread emails with per-account breakdown (was: GET /api/v1/synced_emails/unread_counts)
      email_data = compute_email_unread(user)
      counts[:unread_emails] = email_data[:total]
      counts[:email_by_account] = email_data[:by_account]

      counts
    end
  rescue StandardError => e
    Rails.logger.error "[BadgeCountsChannel] compute_counts error for user #{user.id}: #{e.message}\n#{e.backtrace.first(3).join("\n")}"
    empty_counts
  end

  private

  def self.empty_counts
    {
      unread_notifications: 0,
      unread_chat_messages: 0,
      pending_job_proposals: 0,
      pending_case_proposals: 0,
      pending_bills: 0,
      pending_plan_scans: 0,
      unread_emails: 0,
      email_by_account: []
    }
  end

  # Replicate chat_messages#unread_count logic
  def self.compute_chat_unread(user)
    read_timestamps = user.chat_read_timestamps || {}

    partner_ids = ChatMessage
      .where(recipient_user_id: user.id)
      .where.not(user_id: user.id)
      .distinct
      .pluck(:user_id)

    total = partner_ids.sum do |partner_id|
      conversation_key = "dm-#{[user.id, partner_id].sort.join('-')}"
      last_read_at = if read_timestamps[conversation_key].present?
                       Time.parse(read_timestamps[conversation_key])
                     else
                       user.last_chat_read_at || Time.at(0)
                     end
      ChatMessage.where(user_id: partner_id, recipient_user_id: user.id)
                 .where("created_at > ?", last_read_at)
                 .count
    end

    # Add group conversation unread counts
    ChatConversation.for_user(user.id).each do |conv|
      total += conv.unread_count_for(user)
    end

    total
  end

  # Replicate synced_emails#unread_counts logic
  def self.compute_email_unread(user)
    # IMAP credentials (user-level, not tenant-level)
    user_imap_credentials = ActsAsTenant.without_tenant { ImapCredential.accessible_by(user) }
    user_imap_ids = user_imap_credentials.pluck(:id)

    emails = user_imap_ids.any? ? SyncedEmail.unscoped : SyncedEmail.all

    all_accounts = []

    # IMAP accounts
    user_imap_credentials.each do |cred|
      all_accounts << cred.email_address if cred.email_address.present?
    end

    # MS365 org credentials
    ms365_cred_ids = []
    ms365_mailbox_emails = []
    MicrosoftCredential.refreshable_app.each do |org_cred|
      user_mailboxes = org_cred.sync_config&.dig("user_mailbox_access", user.id.to_s) || []
      if user_mailboxes.any?
        ms365_cred_ids << org_cred.id
        ms365_mailbox_emails.concat(user_mailboxes)
        all_accounts.concat(user_mailboxes)
      end
    end

    # PolarisMail mailboxes
    polaris_mailboxes = EmailMailbox.active.includes(:email_subscription)
                                    .select { |m| m.email_subscription&.status == "active" }
    polaris_mailbox_ids = polaris_mailboxes.map(&:id)
    polaris_mailbox_emails = polaris_mailboxes.map(&:email_address)
    all_accounts.concat(polaris_mailbox_emails)

    # MS365 unread by account (from join table)
    ms365_unread_by_account = {}
    if ms365_cred_ids.any?
      ms365_unread_by_account = SyncedEmailMailbox
        .where(microsoft_credential_id: ms365_cred_ids)
        .where("LOWER(mailbox_owner_email) IN (?)", ms365_mailbox_emails.map(&:downcase))
        .where(is_read: false)
        .group(:mailbox_owner_email)
        .count
    end

    # IMAP unread by account
    imap_unread_by_account = {}
    if user_imap_ids.any?
      imap_unread_by_account = emails
        .where(source_type: "imap", imap_credential_id: user_imap_ids)
        .where(is_read: false)
        .group(:mailbox_owner_email)
        .count
    end

    # PolarisMail unread by account
    polaris_unread_by_account = {}
    if polaris_mailbox_ids.any?
      polaris_mailbox_map = polaris_mailboxes.index_by(&:id)
      SyncedEmail.where(email_mailbox_id: polaris_mailbox_ids, is_read: false)
        .group(:email_mailbox_id)
        .count
        .each do |mailbox_id, count|
          mailbox = polaris_mailbox_map[mailbox_id]
          polaris_unread_by_account[mailbox&.email_address] = count if mailbox
        end
    end

    unread_by_account = ms365_unread_by_account.merge(imap_unread_by_account).merge(polaris_unread_by_account)
    total_unread = unread_by_account.values.sum

    by_account = all_accounts.uniq.map do |email|
      { email: email, count: unread_by_account[email] || 0 }
    end.sort_by { |a| [-a[:count], a[:email]] }

    { total: total_unread, by_account: by_account }
  rescue StandardError => e
    Rails.logger.error "[BadgeCountsChannel] compute_email_unread error: #{e.message}"
    { total: 0, by_account: [] }
  end
end
