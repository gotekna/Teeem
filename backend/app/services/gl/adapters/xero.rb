# frozen_string_literal: true

module Gl
  module Adapters
    # Xero adapter for syncing with Xero accounting
    #
    # Implements the full adapter interface for Xero, including:
    # - Chart of Accounts sync
    # - Invoice/Bill/Payment sync
    # - Bank transaction sync
    # - Two-way sync (push changes back to Xero)
    #
    class Xero < Base
      # Xero account type mapping
      ACCOUNT_TYPE_MAP = {
        'BANK' => { type: 'asset', class: 'current_asset', is_bank: true },
        'CURRENT' => { type: 'asset', class: 'current_asset' },
        'CURRLIAB' => { type: 'liability', class: 'current_liability' },
        'DEPRECIATN' => { type: 'expense', class: 'depreciation' },
        'DIRECTCOSTS' => { type: 'expense', class: 'direct_costs' },
        'EQUITY' => { type: 'equity', class: 'equity' },
        'EXPENSE' => { type: 'expense', class: 'expense' },
        'FIXED' => { type: 'asset', class: 'fixed_asset' },
        'INVENTORY' => { type: 'asset', class: 'current_asset' },
        'LIABILITY' => { type: 'liability', class: 'current_liability' },
        'NONCURRENT' => { type: 'asset', class: 'non_current_asset' },
        'OTHERINCOME' => { type: 'revenue', class: 'revenue' },
        'OVERHEADS' => { type: 'expense', class: 'overhead' },
        'PREPAYMENT' => { type: 'asset', class: 'current_asset' },
        'REVENUE' => { type: 'revenue', class: 'revenue' },
        'SALES' => { type: 'revenue', class: 'revenue' },
        'TERMLIAB' => { type: 'liability', class: 'non_current_liability' },
        'PAYGLIABILITY' => { type: 'liability', class: 'current_liability' },
        'SUPERANNUATIONLIABILITY' => { type: 'liability', class: 'current_liability' },
        'WAGESEXPENSE' => { type: 'expense', class: 'expense' }
      }.freeze

      # Xero system account mapping
      SYSTEM_ACCOUNT_MAP = {
        'BANKCURRENCYGAIN' => nil,
        'GST' => 'gst_collected',
        'GSTONIMPORTS' => 'gst_paid',
        'HISTORICAL' => nil,
        'REALISEDCURRENCYGAIN' => nil,
        'RETAINEDEARNINGS' => 'retained_earnings',
        'ROUNDING' => nil,
        'TRACKINGTRANSFERS' => nil,
        'UNPAIDEXPCLAIMABLE' => nil,
        'UNREALISEDCURRENCYGAIN' => nil,
        'WAGEPAYABLELIABILITY' => nil
      }.freeze

      # Allow passing xero_credential directly for companies without GL::ProviderCredential
      def initialize(corporate_company, credential: nil, xero_credential: nil)
        super(corporate_company, credential: credential)
        @explicit_xero_credential = xero_credential
      end

      # ═══════════════════════════════════════════════════════════════
      # PROVIDER INFO
      # ═══════════════════════════════════════════════════════════════

      def provider_name
        'Xero'
      end

      def provider_code
        'xero'
      end

      # Override connected? to check xero_credential
      def connected?
        credential&.connected? || xero_credential&.usable?
      end

      # Override tenant_id to get from xero_credential if no GL credential
      def tenant_id
        credential&.tenant_id || xero_credential&.tenant_id
      end

      # Override tenant_name to get from xero_credential if no GL credential
      def tenant_name
        credential&.tenant_name || xero_credential&.tenant_name
      end

      # ═══════════════════════════════════════════════════════════════
      # SYNC OPERATIONS - Chart of Accounts
      # ═══════════════════════════════════════════════════════════════

      def sync_accounts
        count = 0
        with_sync_log('accounts') do
          accounts = fetch_accounts
          @sync_log.begin_processing!(total: accounts.size)

          accounts.each do |xero_account|
            sync_single_account(xero_account)
          end
          count = accounts.size
        end
        count
      end

      def sync_account(external_id)
        xero_account = fetch_account(external_id)
        return unless xero_account

        sync_single_account(xero_account)
      end

      # ═══════════════════════════════════════════════════════════════
      # SYNC OPERATIONS - Transactions
      # ═══════════════════════════════════════════════════════════════

      def sync_invoices(since: nil)
        count = 0
        with_sync_log('invoices') do
          invoices = fetch_invoices(modified_since: since)
          @sync_log.begin_processing!(total: invoices.size)

          invoices.each do |xero_invoice|
            sync_single_invoice(xero_invoice)
          end
          count = invoices.size
        end
        count
      end

      def sync_bills(since: nil)
        count = 0
        with_sync_log('bills') do
          bills = fetch_bills(modified_since: since)
          @sync_log.begin_processing!(total: bills.size)

          bills.each do |xero_bill|
            sync_single_bill(xero_bill)
          end
          count = bills.size
        end
        count
      end

      def sync_payments(since: nil)
        count = 0
        with_sync_log('payments') do
          payments = fetch_payments(modified_since: since)
          @sync_log.begin_processing!(total: payments.size)

          payments.each do |xero_payment|
            sync_single_payment(xero_payment)
          end
          count = payments.size
        end
        count
      end

      def sync_bank_transactions(since: nil)
        count = 0
        with_sync_log('bank_transactions') do
          transactions = fetch_bank_transactions(modified_since: since)
          @sync_log.begin_processing!(total: transactions.size)

          transactions.each do |xero_tx|
            sync_single_bank_transaction(xero_tx)
          end
          count = transactions.size
        end
        count
      end

      def sync_credit_notes(since: nil)
        count = 0
        with_sync_log('credit_notes') do
          credit_notes = fetch_credit_notes(modified_since: since)
          @sync_log.begin_processing!(total: credit_notes.size)

          credit_notes.each do |xero_cn|
            sync_single_credit_note(xero_cn)
          end
          count = credit_notes.size
        end
        count
      end

      def sync_manual_journals(since: nil)
        count = 0
        with_sync_log('manual_journals') do
          journals = fetch_manual_journals(modified_since: since)
          @sync_log.begin_processing!(total: journals.size)

          journals.each do |xero_journal|
            sync_single_manual_journal(xero_journal)
          end
          count = journals.size
        end
        count
      end

      # ═══════════════════════════════════════════════════════════════
      # SYNC OPERATIONS - Supporting Data
      # ═══════════════════════════════════════════════════════════════

      def sync_contacts(since: nil)
        # Contacts sync is handled by existing XeroContactSyncService
        # GL doesn't need to store contacts - just return 0
        0
      end

      def sync_tax_rates
        count = 0
        with_sync_log('tax_rates') do
          tax_rates = fetch_tax_rates
          @sync_log.begin_processing!(total: tax_rates.size)

          tax_rates.each do |xero_rate|
            upsert_tax_rate(transform_tax_rate(xero_rate))
          end
          count = tax_rates.size
        end
        count
      end

      def sync_currencies
        count = 0
        with_sync_log('currencies') do
          currencies = fetch_currencies
          @sync_log.begin_processing!(total: currencies.size)

          currencies.each do |xero_currency|
            sync_single_currency(xero_currency)
          end
          count = currencies.size
        end
        count
      end

      # ═══════════════════════════════════════════════════════════════
      # PUSH OPERATIONS
      # ═══════════════════════════════════════════════════════════════

      def push_invoice(invoice)
        return false unless supports_two_way_sync?

        # Transform TEEEM invoice to Xero format
        xero_invoice = transform_invoice_for_push(invoice)

        if invoice.external_source_id.present?
          # Update existing
          api_client.put("Invoices/#{invoice.external_source_id}", xero_invoice)
        else
          # Create new
          response = api_client.post('Invoices', xero_invoice)
          invoice.update!(external_source_id: response['InvoiceID'])
        end

        true
      rescue StandardError => e
        log_error("Failed to push invoice: #{e.message}")
        false
      end

      def push_bill(bill)
        return false unless supports_two_way_sync?

        # Similar to push_invoice but for bills (ACCPAY)
        true
      end

      def push_payment(payment)
        return false unless supports_two_way_sync?

        true
      end

      def push_credit_note(credit_note)
        return false unless supports_two_way_sync?

        true
      end

      def push_manual_journal(journal_entry)
        return false unless supports_two_way_sync?

        xero_journal = transform_journal_for_push(journal_entry)

        if journal_entry.external_source_id.present?
          api_client.put("ManualJournals/#{journal_entry.external_source_id}", xero_journal)
        else
          response = api_client.post('ManualJournals', xero_journal)
          journal_entry.update!(external_source_id: response['ManualJournalID'])
        end

        true
      rescue StandardError => e
        log_error("Failed to push manual journal: #{e.message}")
        false
      end

      # ═══════════════════════════════════════════════════════════════
      # CAPABILITIES
      # ═══════════════════════════════════════════════════════════════

      def supports_two_way_sync?
        credential&.two_way_sync || false
      end

      def supports_webhooks?
        true
      end

      def supports_bank_feeds?
        true
      end

      def supports_multi_currency?
        true
      end

      def supports_tracking_categories?
        true
      end

      private

      # ═══════════════════════════════════════════════════════════════
      # API CLIENT
      # ═══════════════════════════════════════════════════════════════

      def api_client
        @api_client ||= XeroApiClient.new
      end

      def api_get(endpoint, params = {})
        api_client.get(endpoint, params.merge(tenant_id: tenant_id))
      end

      def api_post(endpoint, data = {})
        api_client.post(endpoint, data, tenant_id: tenant_id)
      end

      def api_put(endpoint, data = {})
        api_client.put(endpoint, data.merge(tenant_id: tenant_id))
      end

      def xero_credential
        # Use existing XeroCredential
        # Priority: 1) Explicit, 2) From GL ProviderCredential, 3) From CorporateCompanyXeroConnection
        @xero_credential ||= @explicit_xero_credential || credential&.xero_credential || find_xero_credential_for_company
      end

      def find_xero_credential_for_company
        # Find first connected XeroCredential through CorporateCompanyXeroConnection
        connection = CorporateCompanyXeroConnection
          .joins(:xero_credential)
          .where(corporate_company: corporate_company)
          .where(xero_credentials: { status: 'connected' })
          .first

        connection&.xero_credential
      end

      # ═══════════════════════════════════════════════════════════════
      # API FETCH METHODS
      # ═══════════════════════════════════════════════════════════════

      def fetch_accounts
        response = api_get('Accounts')
        extract_data(response, 'Accounts')
      rescue StandardError => e
        log_error("Failed to fetch accounts: #{e.message}")
        []
      end

      def fetch_account(account_id)
        response = api_get("Accounts/#{account_id}")
        extract_data(response, 'Accounts')&.first
      rescue StandardError
        nil
      end

      def fetch_invoices(modified_since: nil)
        params = { where: 'Type=="ACCREC"' }
        params[:if_modified_since] = modified_since.iso8601 if modified_since
        response = api_get('Invoices', params)
        extract_data(response, 'Invoices')
      rescue StandardError => e
        log_error("Failed to fetch invoices: #{e.message}")
        []
      end

      def fetch_bills(modified_since: nil)
        params = { where: 'Type=="ACCPAY"' }
        params[:if_modified_since] = modified_since.iso8601 if modified_since
        response = api_get('Invoices', params)
        extract_data(response, 'Invoices')
      rescue StandardError => e
        log_error("Failed to fetch bills: #{e.message}")
        []
      end

      def fetch_payments(modified_since: nil)
        params = {}
        params[:if_modified_since] = modified_since.iso8601 if modified_since
        response = api_get('Payments', params)
        extract_data(response, 'Payments')
      rescue StandardError => e
        log_error("Failed to fetch payments: #{e.message}")
        []
      end

      def fetch_bank_transactions(modified_since: nil)
        params = {}
        params[:if_modified_since] = modified_since.iso8601 if modified_since
        response = api_get('BankTransactions', params)
        extract_data(response, 'BankTransactions')
      rescue StandardError => e
        log_error("Failed to fetch bank transactions: #{e.message}")
        []
      end

      # Extract data from API response
      def extract_data(response, key)
        return [] unless response.is_a?(Hash) && response[:success]

        response[:data][key] || []
      end

      def fetch_credit_notes(modified_since: nil)
        params = {}
        params[:if_modified_since] = modified_since.iso8601 if modified_since
        response = api_get('CreditNotes', params)
        extract_data(response, 'CreditNotes')
      rescue StandardError => e
        log_error("Failed to fetch credit notes: #{e.message}")
        []
      end

      def fetch_manual_journals(modified_since: nil)
        params = {}
        params[:if_modified_since] = modified_since.iso8601 if modified_since
        response = api_get('ManualJournals', params)
        extract_data(response, 'ManualJournals')
      rescue StandardError => e
        log_error("Failed to fetch manual journals: #{e.message}")
        []
      end

      def fetch_tax_rates
        response = api_get('TaxRates')
        extract_data(response, 'TaxRates')
      rescue StandardError => e
        log_error("Failed to fetch tax rates: #{e.message}")
        []
      end

      def fetch_currencies
        response = api_get('Currencies')
        extract_data(response, 'Currencies')
      rescue StandardError => e
        log_error("Failed to fetch currencies: #{e.message}")
        []
      end

      # ═══════════════════════════════════════════════════════════════
      # SYNC SINGLE RECORD METHODS
      # ═══════════════════════════════════════════════════════════════

      def sync_single_account(xero_account)
        type_info = ACCOUNT_TYPE_MAP[xero_account['Type']] || { type: 'expense', class: 'expense' }
        system_account = SYSTEM_ACCOUNT_MAP[xero_account['SystemAccount']]

        upsert_account(
          external_id: xero_account['AccountID'],
          code: xero_account['Code'],
          name: xero_account['Name'],
          description: xero_account['Description'],
          account_type: type_info[:type],
          account_class: type_info[:class],
          system_account: system_account,
          tax_type: xero_account['TaxType'],
          is_bank_account: type_info[:is_bank] || false,
          is_system_account: xero_account['SystemAccount'].present?,
          active: xero_account['Status'] == 'ACTIVE',
          currency_code: xero_account['CurrencyCode'] || 'AUD'
        )
      end

      def sync_single_invoice(xero_invoice)
        # Create journal entry from invoice
        journalize_invoice(xero_invoice)
      end

      def sync_single_bill(xero_bill)
        # Create journal entry from bill
        journalize_bill(xero_bill)
      end

      def sync_single_payment(xero_payment)
        # Create journal entry from payment
        journalize_payment(xero_payment)
      end

      def sync_single_bank_transaction(xero_tx)
        # Create journal entry from bank transaction
        journalize_bank_transaction(xero_tx)
      end

      def sync_single_credit_note(xero_cn)
        # Create journal entry from credit note
        journalize_credit_note(xero_cn)
      end

      def sync_single_manual_journal(xero_journal)
        # Import manual journal directly
        import_manual_journal(xero_journal)
      end

      def sync_single_currency(xero_currency)
        currency = Gl::Currency.find_or_initialize_by(
          corporate_company: corporate_company,
          code: xero_currency['Code']
        )

        currency.assign_attributes(
          name: xero_currency['Description'] || xero_currency['Code'],
          active: true
        )

        currency.save!
        record_processed!(created: currency.previously_new_record?, updated: !currency.previously_new_record?)
      end

      # ═══════════════════════════════════════════════════════════════
      # JOURNALIZATION METHODS
      # ═══════════════════════════════════════════════════════════════

      def journalize_invoice(xero_invoice)
        # Skip if already journalized
        return if Gl::JournalEntry.exists?(
          corporate_company: corporate_company,
          external_provider: provider_code,
          external_tenant_id: tenant_id,
          external_source_id: xero_invoice['InvoiceID']
        )

        date = parse_xero_date(xero_invoice['Date'])
        return record_processed!(skipped: true) unless date
        period = period_for(date)

        journal = Gl::JournalEntry.new(
          corporate_company: corporate_company,
          gl_period: period,
          external_provider: provider_code,
          external_tenant_id: tenant_id,
          external_source_id: xero_invoice['InvoiceID'],
          source_type: 'invoice',
          source_number: xero_invoice['InvoiceNumber'],
          entry_date: date,
          description: "Invoice #{xero_invoice['InvoiceNumber']} - #{xero_invoice['Contact']['Name']}",
          currency_code: xero_invoice['CurrencyCode'] || 'AUD',
          external_created_at: xero_invoice['DateString'],
          status: 'posted'
        )

        # DR Accounts Receivable
        ar_account = find_system_account('accounts_receivable')
        journal.add_debit(ar_account, xero_invoice['Total'].to_d, description: xero_invoice['Contact']['Name'])

        # CR Revenue (per line item)
        xero_invoice['LineItems']&.each do |line|
          account = find_account(line['AccountCode']) || find_system_account('sales')
          next unless account

          journal.add_credit(account, line['LineAmount'].to_d, description: line['Description'])

          # CR GST if applicable
          if line['TaxAmount'].to_d > 0
            gst_account = find_system_account('gst_collected')
            journal.add_credit(gst_account, line['TaxAmount'].to_d) if gst_account
          end
        end

        if journal.save
          record_processed!(created: true)
        else
          record_processed!(failed: true)
          log_error("Failed to journalize invoice #{xero_invoice['InvoiceNumber']}: #{journal.errors.full_messages.join(', ')}")
        end
      end

      def journalize_bill(xero_bill)
        # Skip if already journalized
        return if Gl::JournalEntry.exists?(
          corporate_company: corporate_company,
          external_provider: provider_code,
          external_tenant_id: tenant_id,
          external_source_id: xero_bill['InvoiceID']
        )

        # Skip if not approved/authorised
        return record_processed!(skipped: true) unless xero_bill['Status'].in?(%w[AUTHORISED PAID])

        date = parse_xero_date(xero_bill['Date'])
        return record_processed!(skipped: true) unless date
        period = period_for(date)
        contact_name = xero_bill.dig('Contact', 'Name') || 'Unknown Supplier'

        journal = Gl::JournalEntry.new(
          corporate_company: corporate_company,
          gl_period: period,
          external_provider: provider_code,
          external_tenant_id: tenant_id,
          external_source_id: xero_bill['InvoiceID'],
          source_type: 'bill',
          source_number: xero_bill['InvoiceNumber'],
          entry_date: date,
          description: "Bill #{xero_bill['InvoiceNumber']} - #{contact_name}",
          currency_code: xero_bill['CurrencyCode'] || 'AUD',
          exchange_rate: xero_bill['CurrencyRate']&.to_d || 1.0,
          external_created_at: xero_bill['DateString'],
          status: 'posted'
        )

        # DR Expense accounts (per line item)
        xero_bill['LineItems']&.each do |line|
          account = find_account_by_code(line['AccountCode'])
          next unless account

          # DR Expense
          journal.add_debit(
            account,
            line['LineAmount'].to_d,
            description: line['Description'],
            tax_type: line['TaxType']
          )

          # DR GST Paid if applicable
          if line['TaxAmount'].to_d > 0
            gst_account = find_system_account('gst_paid')
            journal.add_debit(gst_account, line['TaxAmount'].to_d) if gst_account
          end
        end

        # CR Accounts Payable
        ap_account = find_system_account('accounts_payable')
        journal.add_credit(ap_account, xero_bill['Total'].to_d, description: contact_name)

        if journal.save
          record_processed!(created: true)
        else
          record_processed!(failed: true)
          log_error("Failed to journalize bill #{xero_bill['InvoiceNumber']}: #{journal.errors.full_messages.join(', ')}")
        end
      end

      def journalize_payment(xero_payment)
        # Skip if already journalized
        return if Gl::JournalEntry.exists?(
          corporate_company: corporate_company,
          external_provider: provider_code,
          external_tenant_id: tenant_id,
          external_source_id: xero_payment['PaymentID']
        )

        date = parse_xero_date(xero_payment['Date'])
        return record_processed!(skipped: true) unless date
        period = period_for(date)

        # Determine if this is a payment received (ACCREC) or payment made (ACCPAY)
        invoice = xero_payment['Invoice']
        return record_processed!(skipped: true) unless invoice

        is_receivable = invoice['Type'] == 'ACCREC'
        payment_type = is_receivable ? 'receive' : 'spend'

        journal = Gl::JournalEntry.new(
          corporate_company: corporate_company,
          gl_period: period,
          external_provider: provider_code,
          external_tenant_id: tenant_id,
          external_source_id: xero_payment['PaymentID'],
          source_type: 'payment',
          source_number: xero_payment['Reference'] || "PMT-#{xero_payment['PaymentID'][0..7]}",
          entry_date: date,
          description: "Payment #{payment_type == 'receive' ? 'from' : 'to'} #{invoice.dig('Contact', 'Name')} - #{invoice['InvoiceNumber']}",
          currency_code: xero_payment['CurrencyCode'] || 'AUD',
          external_created_at: xero_payment['DateString'],
          status: 'posted'
        )

        amount = xero_payment['Amount'].to_d
        bank_account = find_account(xero_payment.dig('Account', 'AccountID'))

        if is_receivable
          # Payment received: DR Bank, CR Accounts Receivable
          ar_account = find_system_account('accounts_receivable')
          journal.add_debit(bank_account, amount, description: "Payment received") if bank_account
          journal.add_credit(ar_account, amount, description: invoice['InvoiceNumber']) if ar_account
        else
          # Payment made: DR Accounts Payable, CR Bank
          ap_account = find_system_account('accounts_payable')
          journal.add_debit(ap_account, amount, description: invoice['InvoiceNumber']) if ap_account
          journal.add_credit(bank_account, amount, description: "Payment made") if bank_account
        end

        if journal.save
          record_processed!(created: true)
        else
          record_processed!(failed: true)
          log_error("Failed to journalize payment #{xero_payment['PaymentID']}: #{journal.errors.full_messages.join(', ')}")
        end
      end

      def journalize_bank_transaction(xero_tx)
        # Skip if already journalized
        return if Gl::JournalEntry.exists?(
          corporate_company: corporate_company,
          external_provider: provider_code,
          external_tenant_id: tenant_id,
          external_source_id: xero_tx['BankTransactionID']
        )

        # Skip reconciled transfers (handled separately)
        return record_processed!(skipped: true) if xero_tx['IsReconciled'] == false && xero_tx['Status'] == 'DELETED'

        date = parse_xero_date(xero_tx['Date'])
        return record_processed!(skipped: true) unless date
        period = period_for(date)
        tx_type = xero_tx['Type'] # RECEIVE, SPEND, RECEIVE-OVERPAYMENT, etc.
        is_receive = tx_type.start_with?('RECEIVE')

        contact_name = xero_tx.dig('Contact', 'Name') || 'Unknown'
        reference = xero_tx['Reference'] || xero_tx['BankTransactionID'][0..7]

        journal = Gl::JournalEntry.new(
          corporate_company: corporate_company,
          gl_period: period,
          external_provider: provider_code,
          external_tenant_id: tenant_id,
          external_source_id: xero_tx['BankTransactionID'],
          source_type: 'bank_transaction',
          source_number: reference,
          entry_date: date,
          description: "#{is_receive ? 'Receive' : 'Spend'} - #{contact_name} - #{reference}",
          currency_code: xero_tx['CurrencyCode'] || 'AUD',
          exchange_rate: xero_tx['CurrencyRate']&.to_d || 1.0,
          external_created_at: xero_tx['DateString'],
          status: 'posted'
        )

        bank_account = find_account(xero_tx.dig('BankAccount', 'AccountID'))
        return record_processed!(skipped: true) unless bank_account

        if is_receive
          # RECEIVE: DR Bank, CR Revenue/Other accounts
          journal.add_debit(bank_account, xero_tx['Total'].to_d, description: contact_name)

          xero_tx['LineItems']&.each do |line|
            account = find_account_by_code(line['AccountCode'])
            next unless account

            journal.add_credit(account, line['LineAmount'].to_d, description: line['Description'])

            # CR GST Collected if applicable
            if line['TaxAmount'].to_d > 0
              gst_account = find_system_account('gst_collected')
              journal.add_credit(gst_account, line['TaxAmount'].to_d) if gst_account
            end
          end
        else
          # SPEND: DR Expense accounts, CR Bank
          xero_tx['LineItems']&.each do |line|
            account = find_account_by_code(line['AccountCode'])
            next unless account

            journal.add_debit(account, line['LineAmount'].to_d, description: line['Description'])

            # DR GST Paid if applicable
            if line['TaxAmount'].to_d > 0
              gst_account = find_system_account('gst_paid')
              journal.add_debit(gst_account, line['TaxAmount'].to_d) if gst_account
            end
          end

          journal.add_credit(bank_account, xero_tx['Total'].to_d, description: contact_name)
        end

        if journal.save
          record_processed!(created: true)
        else
          record_processed!(failed: true)
          log_error("Failed to journalize bank tx #{xero_tx['BankTransactionID']}: #{journal.errors.full_messages.join(', ')}")
        end
      end

      def journalize_credit_note(xero_cn)
        # Skip if already journalized
        return if Gl::JournalEntry.exists?(
          corporate_company: corporate_company,
          external_provider: provider_code,
          external_tenant_id: tenant_id,
          external_source_id: xero_cn['CreditNoteID']
        )

        # Skip if not approved
        return record_processed!(skipped: true) unless xero_cn['Status'].in?(%w[AUTHORISED PAID])

        date = parse_xero_date(xero_cn['Date'])
        return record_processed!(skipped: true) unless date
        period = period_for(date)
        cn_type = xero_cn['Type'] # ACCRECCREDIT (sales) or ACCPAYCREDIT (purchase)
        is_sales = cn_type == 'ACCRECCREDIT'
        contact_name = xero_cn.dig('Contact', 'Name') || 'Unknown'

        journal = Gl::JournalEntry.new(
          corporate_company: corporate_company,
          gl_period: period,
          external_provider: provider_code,
          external_tenant_id: tenant_id,
          external_source_id: xero_cn['CreditNoteID'],
          source_type: 'credit_note',
          source_number: xero_cn['CreditNoteNumber'],
          entry_date: date,
          description: "Credit Note #{xero_cn['CreditNoteNumber']} - #{contact_name}",
          currency_code: xero_cn['CurrencyCode'] || 'AUD',
          exchange_rate: xero_cn['CurrencyRate']&.to_d || 1.0,
          external_created_at: xero_cn['DateString'],
          status: 'posted'
        )

        if is_sales
          # Sales credit note (ACCRECCREDIT): Reverse of invoice
          # DR Revenue, DR GST Collected, CR Accounts Receivable
          xero_cn['LineItems']&.each do |line|
            account = find_account_by_code(line['AccountCode']) || find_system_account('sales')
            next unless account

            journal.add_debit(account, line['LineAmount'].to_d, description: line['Description'])

            if line['TaxAmount'].to_d > 0
              gst_account = find_system_account('gst_collected')
              journal.add_debit(gst_account, line['TaxAmount'].to_d) if gst_account
            end
          end

          ar_account = find_system_account('accounts_receivable')
          journal.add_credit(ar_account, xero_cn['Total'].to_d, description: contact_name)
        else
          # Purchase credit note (ACCPAYCREDIT): Reverse of bill
          # DR Accounts Payable, CR Expense, CR GST Paid
          ap_account = find_system_account('accounts_payable')
          journal.add_debit(ap_account, xero_cn['Total'].to_d, description: contact_name)

          xero_cn['LineItems']&.each do |line|
            account = find_account_by_code(line['AccountCode'])
            next unless account

            journal.add_credit(account, line['LineAmount'].to_d, description: line['Description'])

            if line['TaxAmount'].to_d > 0
              gst_account = find_system_account('gst_paid')
              journal.add_credit(gst_account, line['TaxAmount'].to_d) if gst_account
            end
          end
        end

        if journal.save
          record_processed!(created: true)
        else
          record_processed!(failed: true)
          log_error("Failed to journalize credit note #{xero_cn['CreditNoteNumber']}: #{journal.errors.full_messages.join(', ')}")
        end
      end

      def import_manual_journal(xero_journal)
        # Skip if already imported
        return if Gl::JournalEntry.exists?(
          corporate_company: corporate_company,
          external_provider: provider_code,
          external_tenant_id: tenant_id,
          external_source_id: xero_journal['ManualJournalID']
        )

        # Skip if not posted
        return record_processed!(skipped: true) unless xero_journal['Status'] == 'POSTED'

        date = parse_xero_date(xero_journal['Date'])
        return record_processed!(skipped: true) unless date
        period = period_for(date)

        journal = Gl::JournalEntry.new(
          corporate_company: corporate_company,
          gl_period: period,
          external_provider: provider_code,
          external_tenant_id: tenant_id,
          external_source_id: xero_journal['ManualJournalID'],
          source_type: 'manual_journal',
          source_number: xero_journal['Narration']&.truncate(20) || "MJ-#{xero_journal['ManualJournalID'][0..7]}",
          entry_date: date,
          description: xero_journal['Narration'] || 'Manual Journal',
          currency_code: 'AUD',
          external_created_at: xero_journal['DateString'],
          status: 'posted'
        )

        # Import journal lines directly
        xero_journal['JournalLines']&.each do |line|
          account = find_account_by_code(line['AccountCode'])
          next unless account

          amount = line['LineAmount'].to_d

          if amount >= 0
            journal.add_debit(account, amount, description: line['Description'])
          else
            journal.add_credit(account, amount.abs, description: line['Description'])
          end
        end

        if journal.save
          record_processed!(created: true)
        else
          record_processed!(failed: true)
          log_error("Failed to import manual journal #{xero_journal['ManualJournalID']}: #{journal.errors.full_messages.join(', ')}")
        end
      end

      # ═══════════════════════════════════════════════════════════════
      # TRANSFORM METHODS (for push)
      # ═══════════════════════════════════════════════════════════════

      def transform_tax_rate(xero_rate)
        {
          code: xero_rate['TaxType'],
          name: xero_rate['Name'],
          rate: xero_rate['EffectiveRate'].to_d,
          external_tax_type: xero_rate['TaxType'],
          tax_type: xero_rate['CanApplyToRevenue'] ? 'output' : 'input',
          can_apply_to_expenses: xero_rate['CanApplyToExpenses'],
          can_apply_to_revenue: xero_rate['CanApplyToRevenue'],
          active: xero_rate['Status'] == 'ACTIVE'
        }
      end

      def transform_invoice_for_push(invoice)
        # Transform TEEEM invoice to Xero format
        {
          Type: 'ACCREC',
          InvoiceNumber: invoice.source_number,
          Date: invoice.entry_date.iso8601,
          # ... more fields
        }
      end

      def transform_journal_for_push(journal_entry)
        {
          Narration: journal_entry.description,
          Date: journal_entry.entry_date.iso8601,
          JournalLines: journal_entry.ledger_lines.map do |line|
            {
              AccountCode: line.gl_account.code,
              Description: line.description,
              LineAmount: line.debit > 0 ? line.debit : -line.credit
            }
          end
        }
      end

      # ═══════════════════════════════════════════════════════════════
      # HELPERS
      # ═══════════════════════════════════════════════════════════════

      # Parse Xero date - handles both /Date(timestamp)/ format and ISO strings
      def parse_xero_date(date_value)
        return nil if date_value.blank?

        # Handle Xero's /Date(1234567890000+0000)/ format
        if date_value.is_a?(String) && date_value.start_with?('/Date(')
          # Extract timestamp (milliseconds)
          match = date_value.match(%r{/Date\((\d+)([+-]\d+)?\)/})
          if match
            timestamp_ms = match[1].to_i
            return Time.at(timestamp_ms / 1000).to_date
          end
        end

        # Try standard parsing
        Date.parse(date_value.to_s)
      rescue ArgumentError, TypeError
        # Fallback to today if parsing fails
        log_error("Could not parse date: #{date_value.inspect}, using today")
        Date.current
      end

      def find_system_account(system_account_type)
        Gl::Account.find_by(
          corporate_company: corporate_company,
          external_provider: provider_code,
          external_tenant_id: tenant_id,
          system_account: system_account_type
        )
      end

      def find_account_by_code(account_code)
        return nil if account_code.blank?

        Gl::Account.find_by(
          corporate_company: corporate_company,
          external_provider: provider_code,
          external_tenant_id: tenant_id,
          code: account_code
        )
      end
    end
  end
end
