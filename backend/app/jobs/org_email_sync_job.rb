# OrgEmailSyncJob - Sync emails for ALL users using Application permissions
# No per-user OAuth needed - uses org-wide app credentials
#
# SSoT Usage (preferred - org-scoped):
#   OrgEmailSyncJob.perform_now('incremental', organization_id: 1)
#   OrgEmailSyncJob.perform_now('full', organization_id: org.id)
#
# Legacy Usage (deprecated - logs warning):
#   OrgEmailSyncJob.perform_now           # Uses first active credential
#   OrgEmailSyncJob.perform_later         # Queue for background processing

class OrgEmailSyncJob < ApplicationJob
  # FRC (Feb 2026): Prevent duplicate queued jobs from running simultaneously.
  # Root cause: EmailHealthMonitorJob (every 5 min) detects long-running syncs as
  # "stalled" and enqueues recovery OrgEmailSyncJobs. For large orgs like Pilgrim
  # (56 mailboxes, 12k+ emails), the initial sync takes 30+ min. Health monitor
  # enqueued 4 duplicate jobs that all ran concurrently → 170% memory (R14) →
  # all jobs fighting over the same data → "Internet message has already been taken"
  # errors → everything slower instead of faster.
  # ❌ WRONG: No dedup - 4 identical jobs consume 4x memory for zero benefit
  # ✅ CORRECT: Only one OrgEmailSyncJob runs at a time; others exit immediately
  include DeduplicatableJob

  # FRC (Feb 2026): Moved from :default to :email_sync queue
  # OrgEmailSyncJob is long-running (10-30 min per org, syncing 10k+ emails).
  # On :default it consumed all 5 threads, starving health monitors for 2+ hrs.
  # On :email_sync (lower priority than default), health monitors always run first.
  queue_as :email_sync

  # Retry network errors up to 2 times with backoff, then discard
  # Runs every 15 minutes, so next scheduled run will try again
  retry_on Net::OpenTimeout, Net::ReadTimeout, SocketError, Errno::ECONNREFUSED, Faraday::TimeoutError,
           wait: :polynomially_longer, attempts: 2

  # FRC (Feb 2026): Handle dead tokens BEFORE generic discard
  # Root cause: discard_on StandardError was silently swallowing DeadTokenError,
  # so emails stopped syncing for 5 days with no visible error. The UI showed "Connected"
  # because nothing updated the credential status. Now we catch DeadTokenError specifically,
  # mark the credential as dead, and log loudly so health monitors can detect it.
  discard_on MicrosoftAppGraphClient::DeadTokenError do |job, error|
    credential_id = job.arguments[1]&.fetch(:credential_id, nil)
    if credential_id
      # Security: Job is queued from tenant-scoped controller, credential_id already validated
      credential = MicrosoftCredential.find_by(id: credential_id)
      if credential
        credential.mark_dead!(error.message)
        Rails.logger.error "[OrgEmailSync] DEAD TOKEN - Marked credential #{credential.name || credential.id} as dead: #{error.message}"
      end
    end
    Rails.logger.error "[OrgEmailSync] DEAD TOKEN - Email sync disabled until reconnection: #{error.message}"
  end

  # Discard other errors - next scheduled run will try again
  discard_on StandardError

  # Performance: Memoization caches to avoid N+1 queries during sync
  attr_reader :user_cache, :blacklist_cache

  # Performance: Parallel folder sync configuration
  # ⚠️ FRC (Jan 2026): Reduced from 3 to 2 threads to prevent connection pool exhaustion
  # Root cause: One-off dynos and worker processes have limited pool sizes (5-10 connections).
  # With 3 threads per folder batch + main thread, we exceed pool capacity.
  # Each user syncs multiple folders, causing cascading connection failures.
  # Fix: 2 threads is safer while still providing parallelism benefit.
  PARALLEL_FOLDER_THREADS = 2       # Background worker: conservative (limited connection pool)
  INLINE_PARALLEL_THREADS = 8       # Web dyno inline sync: more headroom, must finish in 30s
  SYNC_TIMEOUT_SECONDS = 300   # 5 minute timeout per folder
  # ⚠️ FRC (Feb 2026): Per-credential time budget for incremental progress
  # Root cause: Pilgrim Homes (56 mailboxes x 15 years) would take ~56 hours to fully sync.
  # Heroku kills dynos at 30 minutes, so the job dies mid-sync and last_sync_at never updates.
  # Fix: Process as many mailboxes as possible within the budget, update last_sync_at after
  # each successful mailbox, and pick up remaining mailboxes on the next scheduled run.
  PER_CREDENTIAL_TIMEOUT = 10.minutes
  # ⚠️ FRC (Feb 2026): Per-mailbox time budget for fair round-robin
  # Root cause: One big mailbox (accounts@bypilgrim.co, 60+ folders) consumed the entire
  # 10-minute PER_CREDENTIAL_TIMEOUT, so the mailbox loop only processed 1 mailbox per cycle.
  # With 56 mailboxes and only 1 per cycle, 18/56 stayed stuck for 24+ hours because the same
  # already-synced big mailboxes consumed every cycle's budget on incremental sync.
  # Fix: Cap each mailbox at 2 minutes. This allows ~5 mailboxes per cycle, making incremental
  # progress on each. Big mailboxes resume where they left off next cycle (folder-level progress).
  PER_MAILBOX_TIMEOUT = 2.minutes
  # ⚠️ FRC (Feb 2026): Toxic Mailbox Classification
  # Root cause: All errors were treated the same. Permanent errors (deleted user, no license)
  # were retried every cycle, consuming the entire time budget and starving valid mailboxes.
  # Fix: Classify errors. Only permanent errors count toward the skip threshold.
  # Transient errors (rate limit, timeout, service unavailable) don't count - they'll succeed next time.
  PERMANENT_ERROR_PATTERNS = [
    "MailboxNotEnabledForRESTAPI",     # No Exchange Online license
    "MailboxNotFound",                 # Mailbox doesn't exist
    "ErrorMailboxMoveInProgress",      # Mailbox being migrated (temporary but long-lived)
    "ErrorAccessDenied",               # App doesn't have permission
    "ResourceNotFound",                # User/mailbox deleted
    "InvalidUser",                     # Invalid user identifier
    "MailboxInactiveOrSoftDeleted",    # Deactivated mailbox
    "UserNotFound",                    # Azure AD user removed
    "404 -",                           # Generic 404 from Graph API
    "403 -",                           # Generic 403 from Graph API
  ].freeze
  MAX_CONSECUTIVE_ERRORS = 10  # Skip mailbox after this many permanent errors

  # ⚠️ ULTRA FIX (Jan 2026): Never lose emails due to timing issues
  # ════════════════════════════════════════════════════════════════
  # Problem: If last_sync_at=22:20 but an email arrived at 21:43 and wasn't
  # saved (error/timeout/filter), subsequent syncs using since=22:20 would
  # NEVER find that email again.
  #
  # Solution: Always add overlap buffer and enforce minimum lookback.
  # Overlap is SAFE (upsert handles duplicates). Missing emails is NOT.
  # ════════════════════════════════════════════════════════════════
  SYNC_OVERLAP_BUFFER = EmailConstants::SYNC_OVERLAP_BUFFER   # Always look back this much before last_sync_at
  SYNC_MINIMUM_LOOKBACK = EmailConstants::RECENT_EMAIL_WINDOW # Never sync less than this window

  # SSoT: Supports multi-org via organization_id (preferred)
  # Falls back to credential_id or org_name for legacy compatibility (with warning)
  def perform(sync_type = "incremental", organization_id: nil, credential_id: nil, org_name: nil, target_mailbox: nil)
    # Performance: Thread-safe caches for parallel folder sync
    @user_cache = Concurrent::Map.new
    @blacklist_cache = nil
    # SSoT: Find credential using org-scoped lookup
    @credential = find_credential(organization_id: organization_id, credential_id: credential_id, org_name: org_name)

    unless @credential&.status == "connected"
      Rails.logger.info "[OrgEmailSync] Skipping - org Microsoft app not connected"
      return
    end

    # ⚠️ FRC (Feb 2026): Set tenant context for StorageBlob and WarehouseDocument operations
    # Root cause: sync_attachments! → StorageBlob.find_or_create_for_content! → upload_to_storage!
    # → storage_provider (class method) requires ActsAsTenant.current_tenant to find the
    # WarehouseProvider config. Without this, ALL attachment uploads fail with TenantNotFoundError,
    # which caused ~99% of email attachments to never reach Wasabi storage.
    tenant = @credential.tenant
    unless tenant
      Rails.logger.error "[OrgEmailSync] No tenant found for credential #{@credential.id} - cannot sync attachments"
      return
    end

    ActsAsTenant.with_tenant(tenant) do
      sync_config = @credential.sync_config || {}
      sync_all = sync_config["sync_all"] || false
      user_emails = sync_config["user_emails"] || []
      sync_years = sync_config["sync_years"] || 3
      sync_days = sync_config["sync_days"] # Optional: sync by days instead of years

      # Determine which users to sync
      # Priority: 1) sync_all → all tenant mailboxes
      #           2) user_emails configured → use those
      #           3) Auto-detect: TEEEM users whose email matches a tenant mailbox
      if sync_all
        # Get all users from tenant
        client = MicrosoftAppGraphClient.new(@credential)
        tenant_users = client.list_users(select: "id,mail,userPrincipalName")
        user_emails = tenant_users.map { |u| u["mail"] || u["userPrincipalName"] }.compact
      elsif user_emails.empty?
        # FRC (Jan 2026): Auto-detect mailboxes from user_mailbox_access config
        # If Sync All is OFF, only sync mailboxes that are visible to at least one user
        # user_mailbox_access format: { "user_id" => ["mailbox1@...", "mailbox2@..."], ... }
        user_mailbox_access = sync_config["user_mailbox_access"] || {}

        # Collect all unique mailboxes that have at least one user with access
        user_emails = user_mailbox_access.values.flatten.compact.uniq

        Rails.logger.info "[OrgEmailSync] Auto-detected #{user_emails.count} mailboxes from user_mailbox_access"
      end

      if user_emails.empty?
        Rails.logger.info "[OrgEmailSync] No users configured for sync (enable Sync All or add TEEEM users with matching emails)"
        return
      end

      # FRC (Feb 2026): Target a single mailbox for quick inline sync from the UI.
      if target_mailbox.present?
        target = target_mailbox.to_s.downcase.strip
        Rails.logger.info "[SYNC-DEBUG] target_mailbox=#{target_mailbox}, user_emails count=#{user_emails.count}, user_emails=#{user_emails.first(5).join(', ')}"
        if user_emails.map(&:downcase).include?(target)
          user_emails = [target_mailbox]
          Rails.logger.info "[SYNC-DEBUG] Matched! Will sync single mailbox: #{target_mailbox}"
        else
          Rails.logger.warn "[SYNC-DEBUG] Target mailbox #{target_mailbox} NOT in user_emails list: #{user_emails.map(&:downcase).join(', ')}"
          return
        end
      end

      # ⚠️ FRC (Feb 2026): Per-mailbox sync tracking fixes TWO bugs:
      # ════════════════════════════════════════════
      # Bug 1 (Starvation): list_users() returns the same order every time. With
      #   PER_CREDENTIAL_TIMEOUT=10min, only the first ~15 mailboxes get processed.
      #   The remaining 41 are STARVED FOREVER.
      # Bug 2 (Wrong since date): last_sync_at is credential-level (shared by all mailboxes).
      #   Once one mailbox syncs, the incremental `since` becomes ~15min ago for ALL mailboxes,
      #   even ones never synced. So unsynced mailboxes only get last 24h, not full history.
      # Fix: Track per-mailbox sync timestamps. Sort unsynced-first. Use per-mailbox since dates.
      # ════════════════════════════════════════════
      mailbox_synced_at = sync_config["mailbox_synced_at"] || {}
      # ⚠️ FRC (Feb 2026): Toxic Mailbox Fix
      # Root cause: Errored mailboxes never got mailbox_synced_at updated, so they
      # always sorted to the front of the queue and consumed the entire time budget
      # every cycle, starving valid unsynced mailboxes (stuck at 18/56 forever).
      # Fix: Track last ATTEMPT time (success or failure) separately from last SUCCESS time.
      # Sort by attempt time for round-robin fairness. Skip permanently broken mailboxes.
      mailbox_last_attempted_at = sync_config["mailbox_last_attempted_at"] || {}
      mailbox_error_counts = sync_config["mailbox_error_counts"] || {}

      # Sort: never-attempted mailboxes FIRST, then oldest-attempted first
      # This ensures fair round-robin: errored mailboxes rotate to the back after each attempt
      user_emails.sort_by! { |email| mailbox_last_attempted_at[email.downcase] || "0000-00-00" }

      synced_count = user_emails.count { |e| mailbox_synced_at[e.downcase].present? }
      unsynced_count = user_emails.count - synced_count
      errored_count = mailbox_error_counts.count { |_, v| v >= 10 }
      Rails.logger.info "[OrgEmailSync] Starting #{sync_type} sync for #{@credential.name}: #{user_emails.count} mailboxes (#{synced_count} synced, #{unsynced_count} unsynced, #{errored_count} permanently errored) (tenant: #{tenant.name})"

      total_synced = 0
      errors = []
      sync_started_at = Time.current

      # Broadcast sync_started to all tenant users via WebSocket
      broadcast_sync_status_to_tenant(tenant, :started, sync_type: sync_type)

      skipped_count = 0
      user_emails.each_with_index do |user_email, idx|
        # ⚠️ FRC (Feb 2026): Per-credential time budget for incremental progress
        elapsed = Time.current - sync_started_at
        Rails.logger.info "[SYNC-DEBUG] Mailbox #{idx + 1}/#{user_emails.count}: #{user_email} (elapsed: #{elapsed.round(1)}s)"
        if elapsed > PER_CREDENTIAL_TIMEOUT
          remaining = user_emails.count - total_synced - errors.count - skipped_count
          Rails.logger.warn "[SYNC-DEBUG] TIME BUDGET EXCEEDED (#{PER_CREDENTIAL_TIMEOUT.to_i}s) after #{total_synced} mailboxes, #{remaining} remaining"
          break
        end

        # ⚠️ FRC (Feb 2026): Skip permanently broken mailboxes
        # These are likely deleted users, disabled accounts, or permission-denied mailboxes.
        # Without this, they consume the entire time budget every cycle.
        error_count = mailbox_error_counts[user_email.downcase] || 0
        if error_count >= MAX_CONSECUTIVE_ERRORS
          Rails.logger.warn "[OrgEmailSync] Skipping #{user_email} - #{error_count} consecutive permanent errors"
          skipped_count += 1
          next
        end

        begin
          # Use per-mailbox last_synced_at for accurate since date
          mb_last_synced = mailbox_synced_at[user_email.downcase]&.then { |t| Time.parse(t) rescue nil }
          # ⚠️ FRC (Feb 2026): Metadata-first sync for initial imports
          # Root cause: Pilgrim Homes (56 mailboxes, 11k+ emails) stuck for a week because
          # inline sync_attachments! (2-5s/email) consumed the entire 10-min time budget,
          # leaving most mailboxes unprocessed each cycle.
          # Fix: First-time mailbox sync = metadata only (5x faster). Attachments caught up
          # by RetryPendingAttachmentBlobsJob in background. Incremental = inline (few emails).
          @is_initial_sync = mb_last_synced.nil?
          # Calculate per-mailbox time budget: min(PER_MAILBOX_TIMEOUT, remaining credential budget)
          remaining_credential_time = PER_CREDENTIAL_TIMEOUT - elapsed
          mailbox_budget = [PER_MAILBOX_TIMEOUT.to_i, remaining_credential_time.to_i].min
          Rails.logger.info "[SYNC-DEBUG] #{user_email}: mb_last_synced=#{mb_last_synced&.iso8601 || 'NEVER'}, errors=#{error_count}, initial_sync=#{@is_initial_sync}, budget=#{mailbox_budget}s, calling sync_user_emails... (inline_quick=#{target_mailbox.present?})"
          sync_start = Time.current
          synced = sync_user_emails(user_email, sync_type, sync_years, sync_days, mailbox_last_synced_at: mb_last_synced, inline_quick: target_mailbox.present?, time_budget: mailbox_budget)
          sync_elapsed = (Time.current - sync_start).round(1)
          total_synced += synced
          Rails.logger.info "[SYNC-DEBUG] #{user_email}: synced #{synced} emails in #{sync_elapsed}s"

          # Update per-mailbox sync timestamp and clear error tracking on success
          mailbox_synced_at[user_email.downcase] = Time.current.iso8601
          mailbox_last_attempted_at[user_email.downcase] = Time.current.iso8601
          mailbox_error_counts.delete(user_email.downcase)
          mailbox_errors = sync_config["mailbox_errors"] || {}
          mailbox_errors.delete(user_email.downcase)
          updated_config = sync_config.merge(
            "mailbox_synced_at" => mailbox_synced_at,
            "mailbox_last_attempted_at" => mailbox_last_attempted_at,
            "mailbox_error_counts" => mailbox_error_counts,
            "mailbox_errors" => mailbox_errors
          )
          @credential.update_columns(last_sync_at: Time.current, sync_config: updated_config)
        rescue StandardError => e
          error_msg = e.message
          is_permanent = PERMANENT_ERROR_PATTERNS.any? { |pattern| error_msg.include?(pattern) }
          error_type = is_permanent ? "PERMANENT" : "TRANSIENT"
          Rails.logger.error "[OrgEmailSync] #{error_type} error syncing #{user_email}: #{error_msg}"
          errors << { user: user_email, error: error_msg, permanent: is_permanent }

          # Always track attempt time so this mailbox rotates to the back
          mailbox_last_attempted_at[user_email.downcase] = Time.current.iso8601

          if is_permanent
            # Only permanent errors count toward the skip threshold
            mailbox_error_counts[user_email.downcase] = error_count + 1
          end
          # Transient errors (rate limit, timeout) don't increment - they'll succeed next time

          # Store last error details for UI visibility
          mailbox_errors = sync_config["mailbox_errors"] || {}
          mailbox_errors[user_email.downcase] = {
            "message" => error_msg.truncate(200),
            "type" => error_type.downcase,
            "count" => mailbox_error_counts[user_email.downcase] || 0,
            "last_at" => Time.current.iso8601
          }

          updated_config = sync_config.merge(
            "mailbox_last_attempted_at" => mailbox_last_attempted_at,
            "mailbox_error_counts" => mailbox_error_counts,
            "mailbox_errors" => mailbox_errors
          )
          @credential.update_columns(sync_config: updated_config)
        end
      end

      # Final update (also covers the case where all mailboxes completed)
      # FRC (Jan 2026): Use update_columns to bypass optimistic locking
      # Root cause: Long-running syncs (30+ min for 2000+ emails) hit StaleObjectError
      # when credential is modified elsewhere. update_columns is safe for timestamps.
      @credential.update_columns(last_sync_at: Time.current)

      Rails.logger.info "[OrgEmailSync] Completed: #{total_synced} emails synced, #{errors.count} errors, #{skipped_count} skipped (permanently errored)"

      # Broadcast sync_completed to all tenant users via WebSocket
      duration = (Time.current - sync_started_at).round
      broadcast_sync_status_to_tenant(tenant, :completed,
        new_count: total_synced, updated_count: 0, duration_seconds: duration)

      { total_synced: total_synced, errors: errors }
    end # ActsAsTenant.with_tenant
  end

  private

  # ⚠️ FRC (Feb 2026): Inline sync since date fix
  # Root cause: Per-mailbox tracking (mailbox_synced_at) was added AFTER mailboxes were
  # already syncing via the recurring job. So old mailboxes show mb_last_synced=NEVER even
  # though they ARE synced (emails visible up to 15 min ago). Without credential.last_sync_at
  # fallback, since=2011 (15 years) → 217 folders × thousands of emails → H12 timeout.
  # Fix: For inline sync, fall back to credential.last_sync_at (recent, from last recurring run).
  # Background sync keeps the original behavior (full lookback for truly never-synced mailboxes).
  INLINE_FALLBACK_LOOKBACK = 7.days

  def sync_user_emails(user_email, sync_type, sync_years, sync_days = nil, mailbox_last_synced_at: nil, inline_quick: false, time_budget: nil)
    Rails.logger.info "[SYNC-DEBUG] sync_user_emails START for #{user_email} (inline_quick=#{inline_quick})"
    client = MicrosoftAppGraphClient.new(@credential)

    # Determine since date - prefer sync_days over sync_years if both are set
    lookback_time = if sync_days.present?
                      if sync_days == 0
                        Date.current.beginning_of_day  # Just today (from midnight)
                      else
                        sync_days.days.ago  # Last N days (24-hour periods)
                      end
    else
                      sync_years.years.ago
    end

    since = case sync_type
    when "full"
              lookback_time
    else
              if mailbox_last_synced_at
                buffered_time = mailbox_last_synced_at - SYNC_OVERLAP_BUFFER
                minimum_time = SYNC_MINIMUM_LOOKBACK.ago
                [buffered_time, minimum_time].min
              elsif inline_quick && @credential.last_sync_at
                # Inline sync: mailbox IS synced (by recurring job), just missing per-mailbox
                # tracking. Use credential.last_sync_at as fallback for a sane since date.
                buffered_time = @credential.last_sync_at - SYNC_OVERLAP_BUFFER
                minimum_time = SYNC_MINIMUM_LOOKBACK.ago
                Rails.logger.info "[SYNC-DEBUG] #{user_email}: mb_last_synced nil → fallback to credential.last_sync_at=#{@credential.last_sync_at.iso8601}"
                [buffered_time, minimum_time].min
              elsif inline_quick
                INLINE_FALLBACK_LOOKBACK.ago
              else
                lookback_time
              end
    end

    Rails.logger.info "[SYNC-DEBUG] #{user_email}: since=#{since&.iso8601 || 'nil'}, sync_type=#{sync_type}"

    # Get all mail folders
    Rails.logger.info "[SYNC-DEBUG] #{user_email}: Fetching mail folders..."
    folder_start = Time.current
    folders = client.get_user_mail_folders(user_email)
    folder_elapsed = (Time.current - folder_start).round(1)
    Rails.logger.info "[SYNC-DEBUG] #{user_email}: Got #{folders.count} folders in #{folder_elapsed}s"

    # Performance: Parallel folder sync with thread batching
    Rails.logger.info "[SYNC-DEBUG] #{user_email}: Starting sync_folders_parallel..."
    parallel_start = Time.current
    thread_count = inline_quick ? INLINE_PARALLEL_THREADS : PARALLEL_FOLDER_THREADS
    total_synced = sync_folders_parallel(client, user_email, folders, since, thread_count: thread_count, time_budget: time_budget)
    parallel_elapsed = (Time.current - parallel_start).round(1)
    Rails.logger.info "[SYNC-DEBUG] #{user_email}: sync_folders_parallel completed: #{total_synced} emails in #{parallel_elapsed}s"

    # Auto-match unassigned emails after sync
    # Skip for inline_quick - background job handles it, saves time on web dyno
    unless inline_quick
      Rails.logger.info "[SYNC-DEBUG] #{user_email}: Starting auto_match_user_emails..."
      match_start = Time.current
      auto_match_user_emails(user_email)
      match_elapsed = (Time.current - match_start).round(1)
      Rails.logger.info "[SYNC-DEBUG] #{user_email}: auto_match completed in #{match_elapsed}s"
    end

    Rails.logger.info "[SYNC-DEBUG] sync_user_emails DONE for #{user_email}: #{total_synced} total"
    total_synced
  end

  # Performance: Sync folders in parallel batches
  # Impact: ~2x faster sync for users with many folders (Inbox, Sent, Archive, etc.)
  # ⚠️ FRC (Jan 2026): Added retry logic for database connection errors
  def sync_folders_parallel(client, user_email, folders, since, thread_count: PARALLEL_FOLDER_THREADS, time_budget: nil)
    return 0 if folders.empty?

    # Thread-safe counter for total synced emails
    total_synced = Concurrent::AtomicFixnum.new(0)
    failed_folders = Concurrent::Array.new

    # Capture tenant for child threads (ActsAsTenant uses thread-local storage)
    current_tenant = ActsAsTenant.current_tenant
    mailbox_start = Time.current

    Rails.logger.info "[SYNC-DEBUG] sync_folders_parallel: #{folders.count} folders, threads=#{thread_count}, time_budget=#{time_budget || 'unlimited'}s"

    # Process folders in parallel batches
    batch_num = 0
    folders.each_slice(thread_count) do |folder_batch|
      # ⚠️ FRC (Feb 2026): Per-mailbox time budget check between folder batches
      # Without this, one mailbox with 60+ folders consumed the entire credential budget,
      # starving all other mailboxes (stuck at 18/56 for 24+ hours).
      if time_budget && (Time.current - mailbox_start) > time_budget
        remaining_folders = folders.count - (batch_num * thread_count)
        Rails.logger.info "[SYNC-DEBUG] #{user_email}: MAILBOX TIME BUDGET (#{time_budget}s) exceeded after #{batch_num} batches, #{remaining_folders} folders deferred to next cycle"
        break
      end

      batch_num += 1
      batch_start = Time.current
      Rails.logger.info "[SYNC-DEBUG] Batch #{batch_num}: #{folder_batch.map { |f| f[:name] }.join(', ')}"

      threads = folder_batch.map do |folder|
        Thread.new do
          # Set tenant context in child thread (thread-local, not inherited)
          ActsAsTenant.current_tenant = current_tenant
          # Each thread gets its own database connection from the pool
          ActiveRecord::Base.connection_pool.with_connection do
            begin
              # Create a new client instance per thread (thread-safe HTTP)
              thread_client = MicrosoftAppGraphClient.new(@credential)
              folder_start = Time.current
              synced = sync_folder(thread_client, user_email, folder, since)
              folder_elapsed = (Time.current - folder_start).round(1)
              Rails.logger.info "[SYNC-DEBUG] Folder '#{folder[:name]}' done: #{synced} emails in #{folder_elapsed}s"
              total_synced.increment(synced)
            rescue ActiveRecord::ConnectionNotEstablished, ActiveRecord::StatementInvalid => e
              # Database connection error - mark for retry
              Rails.logger.warn "[SYNC-DEBUG] DB connection error for folder #{folder[:name]}, will retry: #{e.message}"
              failed_folders << folder
            rescue StandardError => e
              Rails.logger.error "[SYNC-DEBUG] Parallel sync error for folder #{folder[:name]}: #{e.class}: #{e.message}"
              Rails.logger.error "[SYNC-DEBUG] #{e.backtrace.first(3).join("\n")}"
            end
          end
        end
      end

      # Wait for all threads in this batch to complete (with timeout)
      threads.each_with_index do |thread, i|
        joined = thread.join(SYNC_TIMEOUT_SECONDS)
        if joined.nil?
          Rails.logger.error "[SYNC-DEBUG] Thread #{i} TIMED OUT after #{SYNC_TIMEOUT_SECONDS}s - killing"
          thread.kill
        end
      end

      batch_elapsed = (Time.current - batch_start).round(1)
      Rails.logger.info "[SYNC-DEBUG] Batch #{batch_num} completed in #{batch_elapsed}s (total so far: #{total_synced.value})"
    end

    # Retry failed folders sequentially (connection pool should have connections now)
    if failed_folders.any?
      Rails.logger.info "[OrgEmailSync] Retrying #{failed_folders.count} failed folders sequentially"
      failed_folders.each do |folder|
        begin
          synced = sync_folder(client, user_email, folder, since)
          total_synced.increment(synced)
        rescue StandardError => e
          Rails.logger.error "[OrgEmailSync] Retry failed for folder #{folder[:name]}: #{e.message}"
        end
      end
    end

    total_synced.value
  end

  def sync_folder(client, user_email, folder, since)
    synced = 0
    page = 0
    skip = 0
    max_pages = 200 # Increased from 50 to handle large mailboxes (200 * 100 = 20,000 emails per folder)

    loop do
      page_start = Time.current
      emails = client.get_user_emails(
        user_email,
        folder: folder[:id],
        top: 100,
        since: since,
        skip: skip
      )
      api_elapsed = (Time.current - page_start).round(1)

      break if emails.empty?

      upsert_start = Time.current
      emails.each do |email_data|
        # Upsert into SyncedEmail
        warehouse_email = upsert_email(email_data, user_email, folder[:name])
        synced += 1 if warehouse_email
      end
      upsert_elapsed = (Time.current - upsert_start).round(1)

      Rails.logger.info "[SYNC-DEBUG] #{folder[:name]} page #{page}: #{emails.count} emails (API: #{api_elapsed}s, upsert: #{upsert_elapsed}s, total synced: #{synced})"

      page += 1
      skip += 100 # Move to next page
      break if page >= max_pages || emails.count < 100
    end

    Rails.logger.info "[OrgEmailSync] Synced #{synced} emails from #{folder[:name]} (#{page} pages)"
    synced
  end

  def upsert_email(email_data, owner_email, folder_name)
    # Transform Graph API response to our format
    internet_message_id = email_data["internetMessageId"] || email_data["id"]

    # Extract sender info first (needed for filtering)
    from_data = email_data["from"]&.dig("emailAddress") || {}
    from_email = from_data["address"]
    from_name = from_data["name"]
    subject = email_data["subject"] || ""
    has_attachments = email_data["hasAttachments"] || false

    # FRC (Jan 2026): For Sent/Draft emails, MS Graph API may not include 'from' field
    # since the sender is implicit (the mailbox owner). Use owner_email as fallback.
    if from_email.blank? && %w[Sent\ Items Drafts].include?(folder_name)
      from_email = owner_email
      Rails.logger.debug "[OrgEmailSync] Using owner_email as from_email for #{folder_name}: #{from_email}"
    end

    # NOTE: Drafts are now synced (to match Office 365 exactly)
    # They will appear with folder_name="Drafts" and can be filtered in frontend

    # ALWAYS FILTER: Junk/Spam emails (already classified as spam by email provider)
    if folder_name == "Junk Email"
      Rails.logger.debug "[OrgEmailSync] Skipping junk/spam email: #{subject} from #{from_email}"
      return nil
    end

    # NEVER FILTER: Sent items (unless internal)
    if folder_name == "Sent Items"
      # Skip internal emails in Sent Items (we'll get them from recipient's inbox)
      to_emails = (email_data["toRecipients"] || []).map { |r| r.dig("emailAddress", "address") }.compact
      cc_emails = (email_data["ccRecipients"] || []).map { |r| r.dig("emailAddress", "address") }.compact
      all_recipients = (to_emails + cc_emails).map { |email| email.downcase }
      org_domain = owner_email.split("@").last # e.g., "lyw.org.au"

      # If ALL recipients are internal (same domain), skip this sent email
      if all_recipients.any? && all_recipients.all? { |recipient| recipient.end_with?("@#{org_domain}") }
        Rails.logger.debug "[OrgEmailSync] Skipping internal sent email (will sync from inbox): #{subject}"
        return nil
      end
    # Otherwise, sync external sent emails
    # NEVER FILTER: Emails with attachments
    elsif has_attachments
    # Always sync emails with attachments (important business emails)
    # FILTER: Check against blacklist
    else
      # Use database-backed blacklist (supports incremental & full sync)
      if EmailBlacklistItem.should_filter?(
        from_email: from_email,
        from_name: from_data["name"],
        subject: subject
      )
        Rails.logger.debug "[OrgEmailSync] Skipping blacklisted email: #{subject} from #{from_email}"
        return nil
      end
    end

    # Ultra Email Architecture: Store email content ONCE, link to multiple mailboxes
    # ⚠️ FRC (Jan 2026): Same email can appear in multiple mailboxes (e.g., To: both James and Andrew)
    # Solution: Store content once via internet_message_id, track mailbox appearances separately.
    # This fixes: "email shows for James but not Andrew" - both get linked to the SAME email record.
    email = SyncedEmail.find_or_initialize_by(internet_message_id: internet_message_id)

    # Extract recipients
    to_emails = (email_data["toRecipients"] || []).map { |r| r.dig("emailAddress", "address") }.compact
    cc_emails = (email_data["ccRecipients"] || []).map { |r| r.dig("emailAddress", "address") }.compact

    # Extract body content
    body_data = email_data["body"] || {}
    body_content = body_data["content"]
    body_type = body_data["contentType"]&.downcase

    # Store body in both text and html based on content type
    if body_type == "html"
      body_html = body_content
      body_text = extract_text_from_html(body_content)
    else
      body_text = body_content
      body_html = nil
    end

    # For drafts, use createdDateTime as fallback since they don't have receivedDateTime
    received_at = email_data["receivedDateTime"] || email_data["createdDateTime"]
    is_draft = email_data["isDraft"] || (folder_name == "Drafts")

    # Ultra Email Architecture: Only update content fields if new record or content is blank
    # Don't overwrite existing content from another mailbox sync
    if email.new_record? || email.subject.blank?
      email.assign_attributes(
        subject: email_data["subject"],
        from_email: from_data["address"],
        from_name: from_data["name"],
        to_emails: to_emails,
        cc_emails: cc_emails,
        received_at: received_at,
        sent_at: email_data["sentDateTime"],
        has_attachments: email_data["hasAttachments"] || false,
        body_preview: email_data["bodyPreview"],
        body_text: body_text,
        body_html: body_html,
        conversation_id: email_data["conversationId"],
        importance: email_data["importance"],
        in_reply_to: email_data["inReplyTo"],
        references: email_data["references"],
        microsoft_credential_id: @credential&.id,  # Track which org this email came from
        # SSoT: Multi-tenancy - set tenant_id from credential's organization
        # This ensures emails are isolated per tenant and don't leak across orgs
        tenant_id: @credential&.organization&.tenant_id
      )
    end

    # Always update sync tracking and backward-compat fields
    email.assign_attributes(
      last_synced_at: Time.current,
      # Backward compatibility: Keep mailbox_owner_email (first mailbox to sync wins)
      # SSoT: Use mailbox_appearances for multi-mailbox support
      mailbox_owner_email: email.mailbox_owner_email || owner_email,
      # Keep outlook_id for backward compat (per-mailbox outlook_id is in mailbox_appearances)
      outlook_id: email.outlook_id || email_data["id"],
      # folder_name is per-mailbox, but keep for backward compat
      folder_name: email.folder_name || folder_name,
      # FRC (Jan 2026): Sent emails are always "read" - you wrote them!
      is_read: folder_name == "Sent Items" ? true : (email.is_read.nil? ? (email_data["isRead"] || false) : email.is_read)
    )

    # Set first_synced_at if new record
    email.first_synced_at ||= Time.current

    # Set synced_by_user_id if we can match the owner to a TEEEM user
    # Performance: Use memoized lookup to avoid N+1 (same owner_email repeated for all emails)
    unless email.synced_by_user_id
      teeem_user = find_teeem_user(owner_email)
      email.synced_by_user_id = teeem_user&.id
    end

    # FRC (Feb 2026): Set ssot_owner_id for WebSocket broadcasts
    # Root cause: broadcast_new_email (after_create_commit) returned early because
    # ssot_owner_id was never set. set_ssot_owner! was defined but never called.
    # Fix: Set ssot_owner_id during upsert using synced_by_user_id as default.
    email.ssot_owner_id ||= email.synced_by_user_id

    is_new_record = email.new_record?
    email.save!

    # Ultra Email Architecture: Create/update mailbox appearance (per-mailbox tracking)
    # This links the email to the current mailbox with its specific outlook_id, folder, and read status
    # ⚠️ FRC (Jan 2026): MUST have error handling - if this fails, email exists but isn't linked to mailbox!
    begin
      email.ensure_mailbox_appearance(
        mailbox_email: owner_email,
        outlook_id: email_data["id"],
        folder_name: folder_name,
        # FRC (Jan 2026): Sent emails are always "read" - you wrote them!
        is_read: folder_name == "Sent Items" ? true : (email_data["isRead"] || false),
        microsoft_credential_id: @credential&.id
      )
    rescue StandardError => e
      Rails.logger.error "[OrgEmailSync] Failed to create mailbox appearance for email #{email.id} in #{owner_email}: #{e.message}"
      # Re-raise to ensure the sync knows this email wasn't fully processed
      raise
    end

    # Build recipient links (to Users and Contacts)
    if email.persisted?
      begin
        email.build_recipients!
        Rails.logger.info "[OrgEmailSync] Built recipients for email #{email.id}"
      rescue StandardError => e
        Rails.logger.error "[OrgEmailSync] Failed to build recipients for email #{email.id}: #{e.message}"
        # Continue even if recipient building fails - email is still saved
      end

      # SSoT: Sync attachments to local warehouse storage
      # ⚠️ FRC (Feb 2026): Metadata-first sync for initial imports
      # ════════════════════════════════════════════
      # Why: Initial sync of large orgs (56 mailboxes) was stuck for a week because
      #   inline attachment downloads (2-5s/email) consumed the 10-min time budget.
      # ❌ WRONG: Always sync attachments inline (blocks metadata sync for hours)
      # ✅ CORRECT: Initial sync = metadata only (5x faster throughput).
      #   RetryPendingAttachmentBlobsJob catches up on attachments in background.
      #   Incremental sync = inline (only a few new emails, no bottleneck).
      # ════════════════════════════════════════════
      if is_new_record && email.has_attachments && !@is_initial_sync
        begin
          email.sync_attachments!
          Rails.logger.info "[OrgEmailSync] Synced attachments for email #{email.id}"
        rescue StandardError => e
          Rails.logger.error "[OrgEmailSync] Failed to sync attachments for email #{email.id}: #{e.message}"
          # Continue even if attachment sync fails - email is still saved
        end
      end

      # Apply email rules (SSoT: same pattern as IMAP sync)
      apply_rules_to_email(email)

      # Auto-attach to task if this email belongs to a task's conversation
      auto_attach_to_task(email)

      # SSoT: Sync read status from Office 365 to EmailUserState
      # Office 365 is the source of truth for read status
      sync_read_status_from_office365(email, email_data["isRead"])
    end

    email
  rescue ActiveRecord::RecordInvalid => e
    Rails.logger.warn "[OrgEmailSync] Failed to save email #{internet_message_id}: #{e.message}"
    nil
  end

  def auto_match_user_emails(user_email)
    # Find recently synced unassigned emails for this org
    recent_unassigned = SyncedEmail
      .where(microsoft_credential_id: @credential.id, job_id: nil)
      .where("last_synced_at > ?", 1.hour.ago)

    recent_unassigned.find_each do |email|
      # Try to auto-match based on email addresses in the thread
      matched_job = find_matching_job(email)
      if matched_job
        email.update!(job_id: matched_job.id)
        Rails.logger.info "[OrgEmailSync] Auto-matched email #{email.id} to job #{matched_job.id}"
      end
    end
  end

  def find_matching_job(email)
    # Use the sophisticated matching logic from SyncedEmail model
    # This includes: job ID patterns, contact matching, address matching, street matching
    # Plus: confidence scores and spam filtering
    matches = email.find_matching_jobs

    # Return highest confidence match if above threshold (0.8)
    best_match = matches.first
    return nil unless best_match && best_match[:confidence] >= EmailConstants::DEFAULT_AUTO_ASSIGN_CONFIDENCE

    Rails.logger.info "[OrgEmailSync] Matched email #{email.id} to job #{best_match[:job].id} (#{best_match[:match_type]}, confidence: #{best_match[:confidence]})"
    best_match[:job]
  end

  # SSoT: Find credential with proper org scoping
  # Priority: organization_id > credential_id > org_name > legacy fallback (with warning)
  def find_credential(organization_id: nil, credential_id: nil, org_name: nil)
    # 1. Organization ID (SSoT preferred method)
    # Security: Job is queued from tenant-scoped controller, organization_id already validated
    if organization_id.present?
      org = Organization.find_by(id: organization_id)
      if org
        return MicrosoftCredential.active_for_org(org)
      else
        Rails.logger.warn "[OrgEmailSync] Organization not found: #{organization_id}"
      end
    end

    # 2. Credential ID (direct lookup - SSoT: MicrosoftCredential only)
    # Security: Job is queued from tenant-scoped controller, credential_id already validated
    if credential_id.present?
      cred = MicrosoftCredential.find_by(id: credential_id)
      return cred if cred
    end

    # 3. Organization name (lookup by name)
    # Security: Job is queued from tenant-scoped controller, org_name already validated
    if org_name.present?
      org = Organization.find_by_name_or_slug(org_name)
      if org
        return MicrosoftCredential.active_for_org(org)
      else
        # Lookup by name field on credential
        return MicrosoftCredential.find_by_name(org_name)
      end
    end

    # 4. Fallback (deprecated - logs warning)
    Rails.logger.warn "[OrgEmailSync] DEPRECATED: No organization context provided. " \
                      "Use organization_id parameter for proper org isolation. " \
                      "Falling back to first active credential."
    MicrosoftCredential.active_credential
  end

  def extract_text_from_html(html_content)
    return nil if html_content.blank?

    # Simple HTML stripping - remove tags and decode entities
    text = html_content.gsub(/<[^>]*>/, "")  # Remove HTML tags
    text = CGI.unescapeHTML(text)             # Decode HTML entities (&nbsp;, etc.)
    text.strip
  end

  # Performance: Thread-safe memoized user lookup to avoid N+1 queries
  # Impact: 5,000 queries/day → 1-3 queries/day
  # Uses Concurrent::Map for thread safety during parallel folder sync
  def find_teeem_user(email)
    return nil if email.blank?
    normalized_email = email.to_s.downcase.strip
    @user_cache.fetch_or_store(normalized_email) do
      User.find_by("LOWER(email) = ?", normalized_email)
    end
  end

  # Performance: Memoized blacklist lookup
  # Impact: Avoids repeated blacklist queries during sync
  def cached_blacklist
    @blacklist_cache ||= EmailBlacklistItem.active.pluck(:pattern_type, :pattern)
  end

  # Apply email rules to a newly synced email
  # SSoT: Uses EmailRuleService.apply_rules which handles MS365 via for_email scope
  def apply_rules_to_email(email)
    # Find a user to apply rules with - use synced_by_user if available, else org admin
    user = email.synced_by_user || find_org_admin_user
    return unless user

    service = EmailRuleService.new(user)
    service.apply_rules(email)
  rescue StandardError => e
    Rails.logger.error "[OrgEmailSync] Failed to apply rules to email #{email.id}: #{e.message}"
    # Don't fail the sync if rules fail
  end

  # SSoT: Sync read status from Office 365 to EmailUserState
  # Office 365 is the source of truth - we mirror the isRead status to TEEEM
  # @param email [SyncedEmail] The email record
  # @param is_read [Boolean] The read status from Office 365
  def sync_read_status_from_office365(email, is_read)
    user = email.synced_by_user
    return unless user

    # Get or create the user state and sync the read status from Office 365
    # SSoT: Use email_warehouse (actual association), not synced_email alias
    state = EmailUserState.find_or_initialize_by(email_warehouse: email, user: user)

    # Only update if Office 365 status differs (to preserve manual overrides when syncing older emails)
    # For new states, always sync from Office 365
    if state.new_record? || state.is_read != is_read
      state.is_read = is_read
      state.save!
      Rails.logger.debug "[OrgEmailSync] Synced read status from O365 for email #{email.id}: #{is_read}"
    end
  rescue StandardError => e
    Rails.logger.warn "[OrgEmailSync] Failed to sync read status for email #{email.id}: #{e.message}"
    # Don't fail the sync if read status sync fails
  end

  # Auto-attach email to task if:
  # 1. It belongs to a task's conversation thread (same conversation_id)
  # 2. It matches a task's email keywords (subject/body match)
  # Also notifies the task owner when new emails arrive
  def auto_attach_to_task(email)
    attached_task_ids = Set.new
    user = email.synced_by_user || find_org_admin_user

    # Method 1: Match by conversation_id (existing thread)
    if email.conversation_id.present?
      task_ids = SmTaskAttachment
        .where(attachable_type: "SyncedEmail")
        .joins("INNER JOIN synced_emails ON synced_emails.id = sm_task_attachments.attachable_id")
        .where("synced_emails.conversation_id = ?", email.conversation_id)
        .distinct
        .pluck(:sm_task_id)

      task_ids.each do |task_id|
        next if attached_task_ids.include?(task_id)
        if attach_email_to_task(email, task_id, user, "Reply in conversation thread")
          attached_task_ids << task_id
        end
      end
    end

    # Method 2: Match by email_keywords (subject/body contains keywords)
    matching_tasks = SmTask.tasks_matching_email(email)
    matching_tasks.each do |task|
      next if attached_task_ids.include?(task.id)
      if attach_email_to_task(email, task.id, user, "Matched by keywords: #{task.email_keywords.truncate(50)}")
        attached_task_ids << task.id
      end
    end
  rescue StandardError => e
    Rails.logger.error "[OrgEmailSync] Failed to auto-attach email to task: #{e.message}"
    # Don't fail the sync if auto-attach fails
  end

  # Helper to attach email to a task (returns true if attached, false if already attached)
  def attach_email_to_task(email, task_id, user, notes)
    task = SmTask.find_by(id: task_id)
    return false unless task

    # Check if email is already attached
    already_attached = SmTaskAttachment
      .where(sm_task_id: task_id, attachable_type: "SyncedEmail", attachable_id: email.id)
      .exists?
    return false if already_attached

    # SSoT: Check if user previously deleted this attachment - respect their choice
    # Soft delete prevents auto-attach from re-creating removed attachments
    was_deleted = SmTaskAttachment.was_deleted?(
      sm_task_id: task_id,
      attachable_type: "SyncedEmail",
      attachable_id: email.id
    )
    if was_deleted
      Rails.logger.info "[OrgEmailSync] Skipping auto-attach of email #{email.id} to task ##{task_id} (user previously deleted)"
      return false
    end

    # Attach the new email to the task
    SmTaskAttachment.create!(
      sm_task: task,
      attachable: email,
      attachment_type: "email",
      notes: notes,
      added_by: user
    )

    Rails.logger.info "[OrgEmailSync] Auto-attached email #{email.id} to task ##{task.id} (#{notes})"

    # Notify task owner about the new email
    notify_task_owner_of_reply(task, email, user)
    true
  rescue StandardError => e
    Rails.logger.error "[OrgEmailSync] Failed to attach email #{email.id} to task #{task_id}: #{e.message}"
    false
  end

  # Notify task owner, creator, and followers when a new email arrives in the conversation
  def notify_task_owner_of_reply(task, email, user)
    sender_email = email.from_email&.downcase
    notified_user_ids = Set.new
    notification_message = "#{email.from_name || email.from_email} replied: #{email.subject}"

    # 1. Notify assigned user (if exists and not the sender)
    if task.assigned_user_id.present?
      assigned_user = User.find_by(id: task.assigned_user_id)
      if assigned_user && assigned_user.email&.downcase != sender_email
        create_email_reply_notification(assigned_user, task, notification_message)
        notified_user_ids << assigned_user.id
      end
    end

    # 2. Notify task creator (if exists, not sender, and not already notified)
    if task.created_by_id.present? && !notified_user_ids.include?(task.created_by_id)
      creator = User.find_by(id: task.created_by_id)
      if creator && creator.email&.downcase != sender_email
        create_email_reply_notification(creator, task, notification_message)
        notified_user_ids << creator.id
      end
    end

    # 3. Notify all followers (excluding sender and already notified users)
    task.followers.each do |follower|
      next if notified_user_ids.include?(follower.id)
      next if follower.email&.downcase == sender_email

      create_email_reply_notification(follower, task, notification_message)
      notified_user_ids << follower.id
    end

    Rails.logger.info "[OrgEmailSync] Notified #{notified_user_ids.size} users of new email on task ##{task.id}"
  rescue StandardError => e
    Rails.logger.error "[OrgEmailSync] Failed to notify task users: #{e.message}"
  end

  def create_email_reply_notification(user, task, message)
    Notification.create!(
      user: user,
      notification_type: "task_email_reply",
      notifiable: task,
      title: "New reply on task '#{task.name.truncate(50)}'",
      message: message
    )
  end

  # Find an admin user for applying rules when no specific user is matched
  # SSoT: Use user_roles join table (user.role column was removed in Dec 2025)
  def find_org_admin_user
    @org_admin_user ||= User.with_role("admin").first
  end

  # Broadcast sync status to all users in the tenant via WebSocket
  # ActionCable only delivers to users with active EmailChannel subscriptions
  def broadcast_sync_status_to_tenant(tenant, status, **kwargs)
    tenant.users.select(:id).find_each do |user|
      case status
      when :started
        EmailChannel.broadcast_sync_started(user, sync_type: kwargs[:sync_type] || "incremental")
      when :completed
        EmailChannel.broadcast_sync_completed(user,
          new_count: kwargs[:new_count] || 0,
          updated_count: kwargs[:updated_count] || 0,
          duration_seconds: kwargs[:duration_seconds] || 0)
      end
    end
  rescue StandardError => e
    Rails.logger.error "[OrgEmailSync] Failed to broadcast sync #{status}: #{e.message}"
  end
end
