# frozen_string_literal: true

module Gl
  module Adapters
    # Standalone adapter for TEEEM-only accounting
    #
    # When no external provider is connected, TEEEM acts as its own
    # accounting system. All data is created and managed directly in TEEEM.
    #
    # Sync operations are no-ops since there's nothing to sync from.
    # Push operations are also no-ops since there's nowhere to push to.
    #
    class Standalone < Base
      # ═══════════════════════════════════════════════════════════════
      # PROVIDER INFO
      # ═══════════════════════════════════════════════════════════════

      def provider_name
        'TEEEM Standalone'
      end

      def provider_code
        nil # Standalone has no provider code
      end

      def tenant_id
        nil
      end

      def tenant_name
        corporate_company.name
      end

      def connected?
        true # Standalone is always "connected"
      end

      def standalone?
        true
      end

      # ═══════════════════════════════════════════════════════════════
      # SYNC OPERATIONS - No-ops for standalone
      # ═══════════════════════════════════════════════════════════════

      def sync_accounts
        # No-op - accounts are created directly in TEEEM
        true
      end

      def sync_account(_external_id)
        # No-op
        true
      end

      def sync_invoices(since: nil)
        # No-op
        true
      end

      def sync_bills(since: nil)
        # No-op
        true
      end

      def sync_payments(since: nil)
        # No-op
        true
      end

      def sync_bank_transactions(since: nil)
        # No-op
        true
      end

      def sync_credit_notes(since: nil)
        # No-op
        true
      end

      def sync_manual_journals(since: nil)
        # No-op
        true
      end

      def sync_contacts(since: nil)
        # No-op
        true
      end

      def sync_tax_rates
        # Set up Australian defaults if not already present
        setup_default_tax_rates
        true
      end

      def sync_currencies
        # Set up common currencies if not already present
        setup_default_currencies
        true
      end

      def sync_all(since: nil)
        sync_tax_rates
        sync_currencies
        setup_default_accounts
        true
      end

      def sync_incremental
        # No-op for standalone
        true
      end

      # ═══════════════════════════════════════════════════════════════
      # PUSH OPERATIONS - No-ops for standalone
      # ═══════════════════════════════════════════════════════════════

      def push_invoice(_invoice)
        true
      end

      def push_bill(_bill)
        true
      end

      def push_payment(_payment)
        true
      end

      def push_credit_note(_credit_note)
        true
      end

      def push_manual_journal(_journal_entry)
        true
      end

      # ═══════════════════════════════════════════════════════════════
      # CAPABILITIES
      # ═══════════════════════════════════════════════════════════════

      def supports_two_way_sync?
        false # Nothing to sync to
      end

      def supports_webhooks?
        false
      end

      def supports_bank_feeds?
        false # Would need Basiq/Yodlee integration
      end

      def supports_multi_currency?
        true
      end

      def supports_tracking_categories?
        true # TEEEM can have its own tracking
      end

      private

      def setup_default_tax_rates
        Gl::TaxRate.setup_australian_defaults(corporate_company)
      end

      def setup_default_currencies
        Gl::Currency.setup_defaults_for(corporate_company, base_code: 'AUD')
      end

      def setup_default_accounts
        # Create a basic chart of accounts if none exist
        return if Gl::Account.where(corporate_company: corporate_company, external_provider: nil).exists?

        default_accounts.each do |account_data|
          Gl::Account.create!(
            corporate_company: corporate_company,
            external_provider: nil,
            **account_data
          )
        end
      end

      def default_accounts
        [
          # Assets
          { code: '1000', name: 'Bank Account', account_type: 'asset', account_class: 'current_asset', is_bank_account: true, system_account: 'bank' },
          { code: '1100', name: 'Accounts Receivable', account_type: 'asset', account_class: 'current_asset', system_account: 'accounts_receivable', is_system_account: true },
          { code: '1200', name: 'Inventory', account_type: 'asset', account_class: 'current_asset' },
          { code: '1500', name: 'Fixed Assets', account_type: 'asset', account_class: 'fixed_asset' },
          { code: '1510', name: 'Accumulated Depreciation', account_type: 'asset', account_class: 'fixed_asset' },

          # Liabilities
          { code: '2000', name: 'Accounts Payable', account_type: 'liability', account_class: 'current_liability', system_account: 'accounts_payable', is_system_account: true },
          { code: '2100', name: 'GST Collected', account_type: 'liability', account_class: 'current_liability', system_account: 'gst_collected', is_system_account: true },
          { code: '2110', name: 'GST Paid', account_type: 'asset', account_class: 'current_asset', system_account: 'gst_paid', is_system_account: true },
          { code: '2200', name: 'PAYG Withholding Payable', account_type: 'liability', account_class: 'current_liability' },
          { code: '2300', name: 'Superannuation Payable', account_type: 'liability', account_class: 'current_liability' },
          { code: '2400', name: 'Credit Cards', account_type: 'liability', account_class: 'current_liability' },
          { code: '2500', name: 'Loans', account_type: 'liability', account_class: 'non_current_liability' },

          # Equity
          { code: '3000', name: 'Owner\'s Equity', account_type: 'equity', account_class: 'equity' },
          { code: '3100', name: 'Retained Earnings', account_type: 'equity', account_class: 'equity', system_account: 'retained_earnings', is_system_account: true },
          { code: '3200', name: 'Current Year Earnings', account_type: 'equity', account_class: 'equity', system_account: 'current_year_earnings', is_system_account: true },

          # Revenue
          { code: '4000', name: 'Sales Revenue', account_type: 'revenue', account_class: 'revenue', system_account: 'sales' },
          { code: '4100', name: 'Service Revenue', account_type: 'revenue', account_class: 'revenue' },
          { code: '4200', name: 'Other Income', account_type: 'revenue', account_class: 'revenue' },
          { code: '4300', name: 'Interest Income', account_type: 'revenue', account_class: 'revenue' },

          # Cost of Sales
          { code: '5000', name: 'Cost of Goods Sold', account_type: 'expense', account_class: 'direct_costs', system_account: 'cost_of_sales' },
          { code: '5100', name: 'Direct Labour', account_type: 'expense', account_class: 'direct_costs' },
          { code: '5200', name: 'Subcontractors', account_type: 'expense', account_class: 'direct_costs' },
          { code: '5300', name: 'Materials', account_type: 'expense', account_class: 'direct_costs' },

          # Operating Expenses
          { code: '6000', name: 'Advertising & Marketing', account_type: 'expense', account_class: 'expense' },
          { code: '6100', name: 'Bank Fees', account_type: 'expense', account_class: 'expense' },
          { code: '6200', name: 'Cleaning', account_type: 'expense', account_class: 'expense' },
          { code: '6300', name: 'Consulting & Accounting', account_type: 'expense', account_class: 'expense' },
          { code: '6400', name: 'Depreciation', account_type: 'expense', account_class: 'depreciation' },
          { code: '6500', name: 'Entertainment', account_type: 'expense', account_class: 'expense' },
          { code: '6600', name: 'Insurance', account_type: 'expense', account_class: 'expense' },
          { code: '6700', name: 'Interest Expense', account_type: 'expense', account_class: 'expense' },
          { code: '6800', name: 'Legal Expenses', account_type: 'expense', account_class: 'expense' },
          { code: '6900', name: 'Motor Vehicle Expenses', account_type: 'expense', account_class: 'expense' },
          { code: '7000', name: 'Office Expenses', account_type: 'expense', account_class: 'expense' },
          { code: '7100', name: 'Printing & Stationery', account_type: 'expense', account_class: 'expense' },
          { code: '7200', name: 'Rent', account_type: 'expense', account_class: 'expense' },
          { code: '7300', name: 'Repairs & Maintenance', account_type: 'expense', account_class: 'expense' },
          { code: '7400', name: 'Subscriptions', account_type: 'expense', account_class: 'expense' },
          { code: '7500', name: 'Superannuation', account_type: 'expense', account_class: 'expense' },
          { code: '7600', name: 'Telephone & Internet', account_type: 'expense', account_class: 'expense' },
          { code: '7700', name: 'Travel - National', account_type: 'expense', account_class: 'expense' },
          { code: '7800', name: 'Utilities', account_type: 'expense', account_class: 'expense' },
          { code: '7900', name: 'Wages & Salaries', account_type: 'expense', account_class: 'expense' }
        ]
      end
    end
  end
end
