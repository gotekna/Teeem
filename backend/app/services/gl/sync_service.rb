# frozen_string_literal: true

module Gl
  # GL Sync Service
  #
  # Orchestrates synchronization of GL data from external providers (Xero, QuickBooks, MYOB).
  # Handles full sync, incremental sync, and individual entity syncs.
  #
  # Usage:
  #   # Get adapter for company
  #   adapter = Gl::Adapters.for(corporate)
  #
  #   # Full sync
  #   service = Gl::SyncService.new(adapter)
  #   service.sync_all
  #
  #   # Incremental sync (since last sync)
  #   service.sync_incremental
  #
  #   # Sync specific entities
  #   service.sync_accounts
  #   service.sync_invoices(since: 1.day.ago)
  #
  class SyncService
    attr_reader :adapter, :corporate, :sync_log

    def initialize(adapter)
      @adapter = adapter
      @corporate = adapter.corporate
      @sync_log = nil
    end

    # ═══════════════════════════════════════════════════════════════
    # FULL SYNC
    # ═══════════════════════════════════════════════════════════════

    # Sync everything from the provider
    def sync_all(since: nil)
      return standalone_setup if adapter.standalone?

      with_sync_log('full') do
        log_info('Starting full GL sync')

        # 1. Chart of Accounts (required first)
        sync_accounts

        # 2. Tax Rates
        sync_tax_rates

        # 3. Currencies (for multi-currency)
        sync_currencies

        # 4. Contacts (link to existing contacts)
        sync_contacts(since: since)

        # 5. Invoices (sales)
        sync_invoices(since: since)

        # 6. Bills (purchases)
        sync_bills(since: since)

        # 7. Payments
        sync_payments(since: since)

        # 8. Bank Transactions
        sync_bank_transactions(since: since)

        # 9. Credit Notes
        sync_credit_notes(since: since)

        # 10. Manual Journals
        sync_manual_journals(since: since)

        # 11. Recalculate all balances
        recalculate_balances

        log_info('Full GL sync completed')
      end
    end

    # Sync only changes since last sync
    def sync_incremental
      return true if adapter.standalone?

      last_sync = Gl::SyncLog.last_successful(
        adapter.provider_code,
        adapter.tenant_id,
        'incremental'
      )

      since = last_sync&.completed_at || 24.hours.ago

      with_sync_log('incremental') do
        log_info("Starting incremental sync since #{since}")

        sync_invoices(since: since)
        sync_bills(since: since)
        sync_payments(since: since)
        sync_bank_transactions(since: since)
        sync_credit_notes(since: since)

        recalculate_affected_balances(since)

        log_info('Incremental sync completed')
      end
    end

    # ═══════════════════════════════════════════════════════════════
    # INDIVIDUAL ENTITY SYNC
    # ═══════════════════════════════════════════════════════════════

    def sync_accounts
      adapter.sync_accounts
    end

    def sync_tax_rates
      adapter.sync_tax_rates
    end

    def sync_currencies
      adapter.sync_currencies
    end

    def sync_contacts(since: nil)
      adapter.sync_contacts(since: since)
    end

    def sync_invoices(since: nil)
      adapter.sync_invoices(since: since)
    end

    def sync_bills(since: nil)
      adapter.sync_bills(since: since)
    end

    def sync_payments(since: nil)
      adapter.sync_payments(since: since)
    end

    def sync_bank_transactions(since: nil)
      adapter.sync_bank_transactions(since: since)
    end

    def sync_credit_notes(since: nil)
      adapter.sync_credit_notes(since: since)
    end

    def sync_manual_journals(since: nil)
      adapter.sync_manual_journals(since: since)
    end

    # ═══════════════════════════════════════════════════════════════
    # BALANCE RECALCULATION
    # ═══════════════════════════════════════════════════════════════

    def recalculate_balances
      calculator = Gl::BalanceCalculator.new(
        corporate,
        provider: adapter.provider_code,
        tenant_id: adapter.tenant_id
      )

      # Recalculate all periods
      calculator.recalculate_all
    end

    def recalculate_affected_balances(since)
      # Find periods affected by recent changes
      affected_periods = Gl::JournalEntry
        .where(corporate: corporate)
        .where(external_provider: adapter.provider_code)
        .where(external_tenant_id: adapter.tenant_id)
        .where('created_at >= ? OR updated_at >= ?', since, since)
        .pluck(:gl_period_id)
        .uniq

      return if affected_periods.empty?

      calculator = Gl::BalanceCalculator.new(
        corporate,
        provider: adapter.provider_code,
        tenant_id: adapter.tenant_id
      )

      Gl::Period.where(id: affected_periods).find_each do |period|
        calculator.calculate_period(period)
      end
    end

    # ═══════════════════════════════════════════════════════════════
    # SYNC STATUS
    # ═══════════════════════════════════════════════════════════════

    def sync_status
      last_full = Gl::SyncLog.last_successful(
        adapter.provider_code,
        adapter.tenant_id,
        'full'
      )

      last_incremental = Gl::SyncLog.last_successful(
        adapter.provider_code,
        adapter.tenant_id,
        'incremental'
      )

      running = Gl::SyncLog.sync_running?(
        adapter.provider_code,
        adapter.tenant_id,
        'full'
      ) || Gl::SyncLog.sync_running?(
        adapter.provider_code,
        adapter.tenant_id,
        'incremental'
      )

      {
        provider: adapter.provider_name,
        tenant_id: adapter.tenant_id,
        tenant_name: adapter.tenant_name,
        connected: adapter.connected?,
        standalone: adapter.standalone?,
        last_full_sync: last_full&.completed_at,
        last_incremental_sync: last_incremental&.completed_at,
        sync_running: running,
        capabilities: {
          two_way_sync: adapter.supports_two_way_sync?,
          webhooks: adapter.supports_webhooks?,
          bank_feeds: adapter.supports_bank_feeds?,
          multi_currency: adapter.supports_multi_currency?,
          tracking_categories: adapter.supports_tracking_categories?
        }
      }
    end

    # Get recent sync logs
    def recent_syncs(limit: 20)
      Gl::SyncLog
        .where(corporate: corporate)
        .for_provider(adapter.provider_code, adapter.tenant_id)
        .recent
        .limit(limit)
    end

    private

    # ═══════════════════════════════════════════════════════════════
    # STANDALONE MODE
    # ═══════════════════════════════════════════════════════════════

    def standalone_setup
      log_info('Setting up standalone GL')

      # Create default chart of accounts
      adapter.sync_all

      # Create periods for current FY
      current_fy = Gl::Period.financial_year_for(Date.current)
      Gl::Period.generate_for_year(corporate, current_fy)

      log_info('Standalone GL setup complete')
      true
    end

    # ═══════════════════════════════════════════════════════════════
    # LOGGING
    # ═══════════════════════════════════════════════════════════════

    def with_sync_log(sync_type)
      @sync_log = Gl::SyncLog.start!(
        corporate: corporate,
        provider: adapter.provider_code || 'standalone',
        tenant_id: adapter.tenant_id || 'local',
        sync_type: sync_type,
        trigger: 'manual'
      )

      yield

      @sync_log.complete!
    rescue StandardError => e
      @sync_log&.fail!(e.message, details: { backtrace: e.backtrace.first(10) })
      raise
    end

    def log_info(message)
      @sync_log&.add_detail('log', (@sync_log.details['log'] || []) << {
        level: 'info',
        message: message,
        timestamp: Time.current.iso8601
      })
      Rails.logger.info("[GL::SyncService] #{message}")
    end

    def log_error(message)
      @sync_log&.add_detail('log', (@sync_log.details['log'] || []) << {
        level: 'error',
        message: message,
        timestamp: Time.current.iso8601
      })
      Rails.logger.error("[GL::SyncService] #{message}")
    end
  end
end
