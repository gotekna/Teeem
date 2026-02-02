# frozen_string_literal: true

# XeroContactBatchFetchJob: Fetch contacts from Xero API in pages
#
# Part of the Ultra-Scale Xero Sync Architecture (Feb 2026)
#
# This job fetches contacts from Xero API page by page and dispatches
# processing jobs for each batch.
#
# Flow:
#   FetchJob(page 1) -> ProcessJob(batch 1)
#                    -> FetchJob(page 2) -> ProcessJob(batch 2)
#                                        -> FetchJob(page 3) -> ...
#
# Queue: default (SolidQueue uses default queue)
#
class XeroContactBatchFetchJob < ApplicationJob
  queue_as :default

  # Xero returns max 100 contacts per page
  BATCH_SIZE = 100

  # Max retries before failing the session
  MAX_RETRIES = 3

  def perform(session_id:, page:, tenant_name: nil, retry_count: 0)
    session = XeroSyncSession.find_by(id: session_id)

    unless session
      Rails.logger.error("[XeroContactBatchFetch] Session #{session_id} not found")
      return
    end

    # Skip if session is already failed/completed
    return unless session.fetching?

    tenant_id = session.tenant_id
    Rails.logger.info("[XeroContactBatchFetch] Fetching page #{page} for #{tenant_name || tenant_id}")

    # Use adaptive rate limiter
    rate_limiter = XeroAdaptiveRateLimiter.new(tenant_id)

    # Fetch batch from Xero with rate limiting
    result = rate_limiter.with_rate_limit do
      fetch_contacts_page(session, page)
    end

    unless result[:success]
      handle_fetch_error(session, page, result[:error], retry_count, tenant_name)
      return
    end

    contacts = result[:data]['Contacts'] || []

    Rails.logger.info("[XeroContactBatchFetch] Got #{contacts.size} contacts on page #{page}")

    # Update session progress
    session.increment_fetched!(contacts.size, page: page)

    # Queue processing job for this batch
    unless contacts.empty?
      XeroContactBatchProcessJob.perform_later(
        session_id: session.id,
        xero_contacts: contacts,
        page: page,
        xero_org_id: tenant_id,
        tenant_name: tenant_name
      )
    end

    # Queue next page if more exist
    if contacts.size == BATCH_SIZE
      XeroContactBatchFetchJob.perform_later(
        session_id: session.id,
        page: page + 1,
        tenant_name: tenant_name
      )
    else
      # No more pages - mark fetching complete
      Rails.logger.info("[XeroContactBatchFetch] Fetch complete for #{tenant_name || tenant_id}: #{session.fetched_count} contacts")
      session.start_processing!
    end

  rescue XeroApiClient::RateLimitError => e
    # Handle rate limit with session tracking
    handle_rate_limit(session, page, e, retry_count, tenant_name)
  rescue StandardError => e
    # FAIL FAST - any unexpected error stops the sync
    Rails.logger.error("[XeroContactBatchFetch] Unexpected error: #{e.class.name}: #{e.message}")
    Rails.logger.error(e.backtrace.first(10).join("\n"))
    session.fail!("Page #{page} failed: #{e.class.name}: #{e.message}")
    raise  # Re-raise for Sentry/error tracking
  end

  private

  def fetch_contacts_page(session, page)
    client = XeroApiClient.new

    params = {
      page: page,
      tenant_id: session.tenant_id
    }

    # Add modified_since for incremental sync
    if session.modified_since.present?
      params['If-Modified-Since'] = session.modified_since.utc.httpdate
    end

    client.get('Contacts', params)
  end

  def handle_fetch_error(session, page, error, retry_count, tenant_name)
    if retry_count < MAX_RETRIES
      Rails.logger.warn("[XeroContactBatchFetch] Error on page #{page}, retrying (#{retry_count + 1}/#{MAX_RETRIES}): #{error}")

      # Exponential backoff
      delay = (2 ** retry_count) * 5.seconds

      XeroContactBatchFetchJob.set(wait: delay).perform_later(
        session_id: session.id,
        page: page,
        tenant_name: tenant_name,
        retry_count: retry_count + 1
      )
    else
      Rails.logger.error("[XeroContactBatchFetch] Failed after #{MAX_RETRIES} retries: #{error}")
      session.fail!("Page #{page} failed after #{MAX_RETRIES} retries: #{error}")
    end
  end

  def handle_rate_limit(session, page, error, retry_count, tenant_name)
    Rails.logger.warn("[XeroContactBatchFetch] Rate limited on page #{page}: #{error.message}")

    # Record the rate limit
    retry_after = extract_retry_after(error.message)
    XeroRateLimitTracker.record_lockout!(retry_after, tenant_id: session.tenant_id)

    # Schedule retry after lockout expires
    XeroContactBatchFetchJob.set(wait: (retry_after + 5).seconds).perform_later(
      session_id: session.id,
      page: page,
      tenant_name: tenant_name,
      retry_count: 0  # Reset retry count after rate limit wait
    )
  end

  def extract_retry_after(error_message)
    # Try to extract retry-after from error message
    if match = error_message.match(/(\d+)\s*seconds?/i)
      match[1].to_i
    else
      60  # Default to 60 seconds
    end
  end
end
