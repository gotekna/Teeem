# frozen_string_literal: true

# XeroJobBase - Shared behavior for all Xero sync jobs
#
# Include this concern in any job that interacts with the Xero API to get:
# - Automatic credential validation before running
# - Token refresh if needed
# - Sync event tracking (audit log)
# - Proper retry strategies for different error types
# - Circuit breaker integration
#
# Usage:
#   class XeroInvoiceSyncJob < ApplicationJob
#     include XeroJobBase
#
#     def perform(options = {})
#       with_xero_credential(options) do |credential|
#         # Your sync logic here
#       end
#     end
#   end
#
module XeroJobBase
  extend ActiveSupport::Concern

  # Custom error for when credential is disconnected
  class CredentialDisconnectedError < StandardError; end

  # Custom error for when circuit is open
  class CircuitOpenError < StandardError; end

  included do
    # Retry on rate limit errors with exponential backoff
    retry_on XeroApiClient::RateLimitError,
             wait: :polynomially_longer,
             attempts: 5

    # Retry on auth errors (might be transient)
    retry_on XeroApiClient::AuthenticationError,
             wait: 5.minutes,
             attempts: 3

    # Don't retry if credential is disconnected - requires user action
    discard_on CredentialDisconnectedError

    # Don't retry if circuit is open - wait for reset
    discard_on CircuitOpenError
  end

  # Main wrapper for Xero operations
  # Handles credential lookup, validation, event tracking, and error handling
  #
  # @param options [Hash] Options for the job
  #   - :tenant_id [String] Specific tenant to use
  #   - :credential_id [Integer] Specific credential ID to use
  #   - :sync_type [String] Type of sync for event tracking
  #   - :trigger [String] What triggered this sync (scheduled, webhook, manual)
  # @yield [credential] Block to execute with the credential
  def with_xero_credential(options = {})
    credential = find_credential(options)

    # Validate credential is usable
    validate_credential!(credential)

    # Create sync event for tracking
    @sync_event = create_sync_event(credential, options)

    begin
      # Ensure token is valid
      ensure_valid_token!(credential)

      # Execute the block
      result = yield credential

      # Mark API call success
      XeroTokenManager.record_api_success(credential)

      # Complete the event
      @sync_event&.complete!(
        records_processed: @records_processed || 0,
        records_created: @records_created || 0,
        records_updated: @records_updated || 0,
        records_skipped: @records_skipped || 0
      )

      result
    rescue XeroApiClient::RateLimitError => e
      handle_rate_limit_error(credential, e)
      raise
    rescue XeroApiClient::AuthenticationError => e
      handle_auth_error(credential, e)
      raise
    rescue StandardError => e
      handle_generic_error(credential, e)
      raise
    end
  end

  # Track records processed (call during sync)
  def increment_records_processed(count = 1)
    @records_processed = (@records_processed || 0) + count
  end

  def increment_records_created(count = 1)
    @records_created = (@records_created || 0) + count
  end

  def increment_records_updated(count = 1)
    @records_updated = (@records_updated || 0) + count
  end

  def increment_records_skipped(count = 1)
    @records_skipped = (@records_skipped || 0) + count
  end

  private

  # Find the appropriate credential
  def find_credential(options)
    if options[:credential_id]
      XeroCredential.find(options[:credential_id])
    elsif options[:tenant_id]
      XeroCredential.find_by!(tenant_id: options[:tenant_id])
    else
      XeroCredential.current
    end
  end

  # Validate credential is usable
  def validate_credential!(credential)
    unless credential
      Rails.logger.warn("[#{self.class.name}] No Xero credential available, skipping job")
      raise CredentialDisconnectedError, "No Xero credential available"
    end

    if credential.status == "disconnected"
      Rails.logger.warn("[#{self.class.name}] Credential #{credential.tenant_name} is disconnected, skipping job")
      raise CredentialDisconnectedError, "Credential disconnected: #{credential.tenant_name}"
    end

    if credential.circuit_open?
      Rails.logger.warn("[#{self.class.name}] Circuit is open for #{credential.tenant_name}, skipping job")
      raise CircuitOpenError, "Circuit open for: #{credential.tenant_name}"
    end
  end

  # Ensure token is valid (refresh if needed)
  def ensure_valid_token!(credential)
    unless XeroTokenManager.ensure_valid_token(credential)
      Rails.logger.error("[#{self.class.name}] Failed to ensure valid token for #{credential.tenant_name}")
      raise XeroApiClient::AuthenticationError, "Failed to refresh token"
    end
  end

  # Create sync event for tracking
  def create_sync_event(credential, options)
    sync_type = options[:sync_type] || infer_sync_type
    trigger = options[:trigger] || "scheduled"

    XeroSyncEvent.start!(
      credential: credential,
      sync_type: sync_type,
      trigger: trigger,
      metadata: { job_class: self.class.name, options: options.except(:credential_id) }
    )
  end

  # Infer sync type from job class name
  def infer_sync_type
    case self.class.name
    when /Invoice/ then "invoices"
    when /Contact/ then "contacts"
    when /BankTransaction/ then "bank_transactions"
    when /Attachment/ then "attachments"
    when /Payment/ then "payments"
    when /Quote/ then "quotes"
    else "unknown"
    end
  end

  # Handle rate limit errors
  def handle_rate_limit_error(credential, error)
    Rails.logger.warn("[#{self.class.name}] Rate limited for #{credential.tenant_name}: #{error.message}")
    XeroTokenManager.record_api_failure(credential, error)
    @sync_event&.fail!(error: error.message, error_class: error.class.name)
  end

  # Handle authentication errors
  def handle_auth_error(credential, error)
    Rails.logger.error("[#{self.class.name}] Auth error for #{credential.tenant_name}: #{error.message}")
    XeroTokenManager.record_api_failure(credential, error)
    @sync_event&.fail!(error: error.message, error_class: error.class.name)

    # Try to refresh the token
    XeroTokenManager.refresh_credential(credential)
  end

  # Handle generic errors
  def handle_generic_error(credential, error)
    Rails.logger.error("[#{self.class.name}] Error for #{credential.tenant_name}: #{error.class.name} - #{error.message}")
    XeroTokenManager.record_api_failure(credential, error)
    @sync_event&.fail!(
      error: error.message,
      error_class: error.class.name,
      records_processed: @records_processed || 0
    )
  end
end
