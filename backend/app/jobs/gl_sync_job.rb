# frozen_string_literal: true

class GlSyncJob < ApplicationJob
  queue_as :default

  # Perform GL sync for a corporate company
  #
  # @param corporate_company_id [Integer] The company to sync
  # @param provider [String] Provider name: 'xero', 'quickbooks', 'myob', 'standalone'
  # @param tenant_id [String] Provider's tenant/org ID
  # @param sync_type [String] Type of sync: 'full', 'incremental', 'accounts', etc.
  # @param options [Hash] Additional options
  def perform(corporate_company_id, provider, tenant_id, sync_type = 'full', options = {})
    @corporate_company = Corporate.find(corporate_company_id)
    @provider = provider
    @tenant_id = tenant_id
    @sync_type = sync_type
    @options = options.with_indifferent_access

    Rails.logger.info("[GlSyncJob] Starting #{sync_type} sync for company #{@corporate_company.id} (#{provider}/#{tenant_id})")

    # Get the appropriate adapter
    adapter = get_adapter

    unless adapter
      Rails.logger.error("[GlSyncJob] No adapter found for #{provider}/#{tenant_id}")
      return { success: false, error: 'No adapter configured' }
    end

    # Create sync service
    service = ::Gl::SyncService.new(adapter)

    # Execute the appropriate sync type
    result = case sync_type
             when 'full'
               perform_full_sync(service)
             when 'incremental'
               perform_incremental_sync(service)
             when 'accounts'
               perform_accounts_sync(adapter)
             when 'invoices'
               perform_invoices_sync(adapter)
             when 'bills'
               perform_bills_sync(adapter)
             when 'payments'
               perform_payments_sync(adapter)
             when 'bank_transactions'
               perform_bank_transactions_sync(adapter)
             when 'recalculate'
               perform_recalculate(service)
             else
               { success: false, error: "Unknown sync type: #{sync_type}" }
             end

    Rails.logger.info("[GlSyncJob] Completed #{sync_type} sync: #{result.inspect}")
    result
  rescue ActiveRecord::RecordNotFound => e
    Rails.logger.error("[GlSyncJob] Company not found: #{e.message}")
    { success: false, error: "Company not found: #{e.message}" }
  rescue StandardError => e
    Rails.logger.error("[GlSyncJob] Sync failed: #{e.message}")
    Rails.logger.error(e.backtrace.first(10).join("\n"))
    { success: false, error: e.message }
  end

  private

  def get_adapter
    if @provider.present? && @provider != 'standalone'
      # First try GL::ProviderCredential
      credential = ::Gl::ProviderCredential.find_by(
        corporate_company: @corporate_company,
        provider: @provider,
        tenant_id: @tenant_id
      )

      if credential
        ::Gl::Adapters.for(@corporate_company, credential: credential)
      elsif @provider == 'xero' && @tenant_id.present?
        # Fallback for Xero: use existing XeroCredential
        xero_cred = XeroCredential.find_by(tenant_id: @tenant_id, status: 'connected')
        if xero_cred
          Rails.logger.info("[GlSyncJob] Using XeroCredential fallback for #{@tenant_id}")
          ::Gl::Adapters::Xero.new(@corporate_company, xero_credential: xero_cred)
        else
          Rails.logger.warn("[GlSyncJob] No XeroCredential found for #{@tenant_id}")
          nil
        end
      else
        Rails.logger.warn("[GlSyncJob] No credential found for #{@provider}/#{@tenant_id}")
        nil
      end
    else
      ::Gl::Adapters::Standalone.new(@corporate_company)
    end
  end

  def perform_full_sync(service)
    service.sync_all
    {
      success: true,
      sync_type: 'full',
      status: service.sync_status
    }
  rescue StandardError => e
    { success: false, error: "Full sync failed: #{e.message}" }
  end

  def perform_incremental_sync(service)
    since = @options[:since]&.to_time || 24.hours.ago

    service.sync_incremental(since: since)
    {
      success: true,
      sync_type: 'incremental',
      since: since,
      status: service.sync_status
    }
  rescue StandardError => e
    { success: false, error: "Incremental sync failed: #{e.message}" }
  end

  def perform_accounts_sync(adapter)
    return standalone_noop('accounts') if adapter.is_a?(::Gl::Adapters::Standalone)

    adapter.sync_accounts
    {
      success: true,
      sync_type: 'accounts',
      message: 'Chart of accounts synced'
    }
  rescue StandardError => e
    { success: false, error: "Accounts sync failed: #{e.message}" }
  end

  def perform_invoices_sync(adapter)
    return standalone_noop('invoices') if adapter.is_a?(::Gl::Adapters::Standalone)

    since = @options[:since]&.to_time
    adapter.sync_invoices(since: since)
    {
      success: true,
      sync_type: 'invoices',
      since: since,
      message: 'Invoices synced'
    }
  rescue StandardError => e
    { success: false, error: "Invoices sync failed: #{e.message}" }
  end

  def perform_bills_sync(adapter)
    return standalone_noop('bills') if adapter.is_a?(::Gl::Adapters::Standalone)

    since = @options[:since]&.to_time
    adapter.sync_bills(since: since)
    {
      success: true,
      sync_type: 'bills',
      since: since,
      message: 'Bills synced'
    }
  rescue StandardError => e
    { success: false, error: "Bills sync failed: #{e.message}" }
  end

  def perform_payments_sync(adapter)
    return standalone_noop('payments') if adapter.is_a?(::Gl::Adapters::Standalone)

    since = @options[:since]&.to_time
    adapter.sync_payments(since: since)
    {
      success: true,
      sync_type: 'payments',
      since: since,
      message: 'Payments synced'
    }
  rescue StandardError => e
    { success: false, error: "Payments sync failed: #{e.message}" }
  end

  def perform_bank_transactions_sync(adapter)
    return standalone_noop('bank_transactions') if adapter.is_a?(::Gl::Adapters::Standalone)

    since = @options[:since]&.to_time
    adapter.sync_bank_transactions(since: since)
    {
      success: true,
      sync_type: 'bank_transactions',
      since: since,
      message: 'Bank transactions synced'
    }
  rescue StandardError => e
    { success: false, error: "Bank transactions sync failed: #{e.message}" }
  end

  def perform_recalculate(service)
    service.recalculate_balances
    {
      success: true,
      sync_type: 'recalculate',
      message: 'Balances recalculated'
    }
  rescue StandardError => e
    { success: false, error: "Balance recalculation failed: #{e.message}" }
  end

  def standalone_noop(sync_type)
    {
      success: true,
      sync_type: sync_type,
      message: "No external sync needed for standalone mode"
    }
  end
end
