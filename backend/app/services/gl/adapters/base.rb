# frozen_string_literal: true

module Gl
  module Adapters
    # Abstract base class for all GL provider adapters
    #
    # All providers (Xero, QuickBooks, MYOB) implement this interface.
    # This ensures consistent behavior regardless of which accounting
    # system is connected.
    #
    # Usage:
    #   adapter = Gl::Adapters.for(corporate_company)
    #   adapter.sync_accounts
    #   adapter.sync_invoices(since: 1.day.ago)
    #
    class Base
      attr_reader :corporate_company, :credential, :sync_log

      def initialize(corporate_company, credential: nil)
        @corporate_company = corporate_company
        @credential = credential
        @sync_log = nil
      end

      # ═══════════════════════════════════════════════════════════════
      # PROVIDER INFO
      # ═══════════════════════════════════════════════════════════════

      def provider_name
        raise NotImplementedError, "#{self.class} must implement #provider_name"
      end

      def provider_code
        raise NotImplementedError, "#{self.class} must implement #provider_code"
      end

      def tenant_id
        credential&.tenant_id
      end

      def tenant_name
        credential&.tenant_name
      end

      def connected?
        credential&.connected? || false
      end

      def standalone?
        false
      end

      # ═══════════════════════════════════════════════════════════════
      # SYNC OPERATIONS - Chart of Accounts
      # ═══════════════════════════════════════════════════════════════

      def sync_accounts
        raise NotImplementedError, "#{self.class} must implement #sync_accounts"
      end

      def sync_account(external_id)
        raise NotImplementedError, "#{self.class} must implement #sync_account"
      end

      # ═══════════════════════════════════════════════════════════════
      # SYNC OPERATIONS - Transactions
      # ═══════════════════════════════════════════════════════════════

      def sync_invoices(since: nil)
        raise NotImplementedError, "#{self.class} must implement #sync_invoices"
      end

      def sync_bills(since: nil)
        raise NotImplementedError, "#{self.class} must implement #sync_bills"
      end

      def sync_payments(since: nil)
        raise NotImplementedError, "#{self.class} must implement #sync_payments"
      end

      def sync_bank_transactions(since: nil)
        raise NotImplementedError, "#{self.class} must implement #sync_bank_transactions"
      end

      def sync_credit_notes(since: nil)
        raise NotImplementedError, "#{self.class} must implement #sync_credit_notes"
      end

      def sync_manual_journals(since: nil)
        raise NotImplementedError, "#{self.class} must implement #sync_manual_journals"
      end

      # ═══════════════════════════════════════════════════════════════
      # SYNC OPERATIONS - Supporting Data
      # ═══════════════════════════════════════════════════════════════

      def sync_contacts(since: nil)
        raise NotImplementedError, "#{self.class} must implement #sync_contacts"
      end

      def sync_tax_rates
        raise NotImplementedError, "#{self.class} must implement #sync_tax_rates"
      end

      def sync_currencies
        raise NotImplementedError, "#{self.class} must implement #sync_currencies"
      end

      # ═══════════════════════════════════════════════════════════════
      # FULL SYNC
      # ═══════════════════════════════════════════════════════════════

      def sync_all(since: nil)
        with_sync_log('full') do
          sync_accounts
          sync_tax_rates
          sync_currencies
          sync_contacts(since: since)
          sync_invoices(since: since)
          sync_bills(since: since)
          sync_payments(since: since)
          sync_bank_transactions(since: since)
          sync_credit_notes(since: since)
          sync_manual_journals(since: since)
        end
      end

      def sync_incremental
        last_sync = Gl::SyncLog.last_successful(provider_code, tenant_id, 'incremental')
        since = last_sync&.completed_at || 24.hours.ago

        with_sync_log('incremental') do
          sync_invoices(since: since)
          sync_bills(since: since)
          sync_payments(since: since)
          sync_bank_transactions(since: since)
        end
      end

      # ═══════════════════════════════════════════════════════════════
      # PUSH OPERATIONS (Two-Way Sync)
      # ═══════════════════════════════════════════════════════════════

      def push_invoice(invoice)
        raise NotImplementedError, "#{self.class} must implement #push_invoice"
      end

      def push_bill(bill)
        raise NotImplementedError, "#{self.class} must implement #push_bill"
      end

      def push_payment(payment)
        raise NotImplementedError, "#{self.class} must implement #push_payment"
      end

      def push_credit_note(credit_note)
        raise NotImplementedError, "#{self.class} must implement #push_credit_note"
      end

      def push_manual_journal(journal_entry)
        raise NotImplementedError, "#{self.class} must implement #push_manual_journal"
      end

      # ═══════════════════════════════════════════════════════════════
      # CAPABILITIES
      # ═══════════════════════════════════════════════════════════════

      def supports_two_way_sync?
        false
      end

      def supports_webhooks?
        false
      end

      def supports_bank_feeds?
        false
      end

      def supports_multi_currency?
        true
      end

      def supports_tracking_categories?
        false
      end

      # ═══════════════════════════════════════════════════════════════
      # HELPERS
      # ═══════════════════════════════════════════════════════════════

      protected

      # Find or create an account from external data
      def upsert_account(external_data)
        account = Gl::Account.find_or_initialize_by(
          corporate_company: corporate_company,
          external_provider: provider_code,
          external_tenant_id: tenant_id,
          external_account_id: external_data[:external_id]
        )

        account.assign_attributes(
          code: external_data[:code],
          name: external_data[:name],
          description: external_data[:description],
          account_type: external_data[:account_type],
          account_class: external_data[:account_class],
          system_account: external_data[:system_account],
          tax_type: external_data[:tax_type],
          is_bank_account: external_data[:is_bank_account] || false,
          is_system_account: external_data[:is_system_account] || false,
          active: external_data[:active] != false,
          currency_code: external_data[:currency_code] || 'AUD',
          external_synced_at: Time.current
        )

        if account.save
          record_processed!(created: account.previously_new_record?, updated: !account.previously_new_record?)
          account
        else
          record_processed!(failed: true)
          log_error("Failed to save account #{external_data[:code]}: #{account.errors.full_messages.join(', ')}")
          nil
        end
      end

      # Find or create a tax rate from external data
      def upsert_tax_rate(external_data)
        tax_rate = Gl::TaxRate.find_or_initialize_by(
          corporate_company: corporate_company,
          external_provider: provider_code,
          external_tenant_id: tenant_id,
          code: external_data[:code],
          tax_type: external_data[:tax_type]
        )

        tax_rate.assign_attributes(
          name: external_data[:name],
          rate: external_data[:rate],
          external_tax_type: external_data[:external_tax_type],
          can_apply_to_expenses: external_data[:can_apply_to_expenses] != false,
          can_apply_to_revenue: external_data[:can_apply_to_revenue] != false,
          active: external_data[:active] != false
        )

        if tax_rate.save
          record_processed!(created: tax_rate.previously_new_record?, updated: !tax_rate.previously_new_record?)
          tax_rate
        else
          record_processed!(failed: true)
          nil
        end
      end

      # Start a sync log
      def with_sync_log(sync_type, &block)
        @sync_log = Gl::SyncLog.start!(
          corporate_company: corporate_company,
          provider: provider_code,
          tenant_id: tenant_id,
          sync_type: sync_type,
          trigger: 'manual',
          credential: credential
        )

        begin
          yield
          @sync_log.complete!
        rescue StandardError => e
          @sync_log.fail!(e.message, details: { backtrace: e.backtrace.first(10) })
          raise
        end
      end

      # Record progress
      def record_processed!(created: false, updated: false, skipped: false, failed: false)
        return unless @sync_log

        @sync_log.record_processed!(
          created: created,
          updated: updated,
          skipped: skipped,
          failed: failed
        )
      end

      # Log error details
      def log_error(message)
        return unless @sync_log

        errors = @sync_log.error_details['errors'] || []
        errors << { message: message, timestamp: Time.current.iso8601 }
        @sync_log.add_error_detail('errors', errors)
      end

      # Get the period for a date
      def period_for(date)
        Gl::Period.for_date(corporate_company, date, provider: provider_code, tenant_id: tenant_id)
      end

      # Find an account by external ID
      def find_account(external_id)
        Gl::Account.find_by(
          corporate_company: corporate_company,
          external_provider: provider_code,
          external_tenant_id: tenant_id,
          external_account_id: external_id
        )
      end

      # Find a contact (from existing Contact model)
      def find_contact(external_id)
        # This would link to existing Contact model via external links
        ContactExternalLink.find_by(
          external_id: external_id,
          provider: provider_code
        )&.contact
      end
    end
  end
end
