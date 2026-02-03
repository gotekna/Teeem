# frozen_string_literal: true

module Gl
  # Service for revaluing foreign currency balances at period end
  #
  # Handles:
  # - Bank account revaluation (foreign currency bank accounts)
  # - Accounts receivable revaluation (unpaid foreign invoices)
  # - Accounts payable revaluation (unpaid foreign bills)
  # - Creates adjustment journal entries for gains/losses
  #
  class CurrencyRevaluationService
    attr_reader :corporate, :revaluation_date, :converter

    # Standard account codes for exchange gains/losses
    EXCHANGE_GAIN_ACCOUNT = 'exchange_gain'   # Revenue account
    EXCHANGE_LOSS_ACCOUNT = 'exchange_loss'   # Expense account

    def initialize(corporate, revaluation_date: Date.current)
      @corporate = corporate
      @revaluation_date = revaluation_date
      @converter = Gl::CurrencyConverter.new(corporate)
      @revaluations = []
    end

    # Run full revaluation for all foreign currency items
    #
    # @param create_journals [Boolean] Whether to create adjustment journals
    # @return [Hash] Summary of revaluations performed
    #
    def run_full_revaluation(create_journals: true)
      @revaluations = []

      # Revalue each category
      revalue_bank_accounts
      revalue_receivables
      revalue_payables

      # Create journal entry if there are gains/losses
      journal = nil
      if create_journals && total_gain_loss != 0
        journal = create_revaluation_journal
      end

      {
        success: true,
        revaluation_date: revaluation_date,
        summary: {
          bank_accounts: bank_account_summary,
          receivables: receivables_summary,
          payables: payables_summary,
          total_gain: total_gains,
          total_loss: total_losses,
          net_gain_loss: total_gain_loss
        },
        revaluations: @revaluations,
        journal_entry: journal ? { id: journal.id, entry_number: journal.entry_number } : nil
      }
    end

    # Revalue foreign currency bank accounts
    def revalue_bank_accounts
      foreign_bank_accounts.each do |account|
        revalue_bank_account(account)
      end
    end

    # Revalue a single bank account
    def revalue_bank_account(account)
      # Get current balance in foreign currency
      balance = current_balance_for(account)
      return if balance.zero?

      currency = Gl::Currency.find_by(
        corporate: corporate,
        code: account.currency_code
      )
      return unless currency

      # Get the original base value (sum of all transactions at their original rates)
      original_base = original_base_value_for(account)

      # Calculate current base value at today's rate
      current_result = converter.to_base(balance, from_currency: currency, date: revaluation_date)
      current_base = current_result[:amount]

      # Gain/loss is the difference
      gain_loss = current_base - original_base

      return if gain_loss.abs < 0.01 # Skip negligible amounts

      @revaluations << {
        type: 'bank_account',
        account_id: account.id,
        account_name: account.name,
        currency: currency.code,
        foreign_balance: balance,
        original_base_value: original_base,
        current_base_value: current_base,
        gain_loss: gain_loss,
        gain_loss_type: gain_loss.positive? ? 'gain' : 'loss',
        rate_used: current_result[:rate]
      }
    end

    # Revalue unpaid foreign currency invoices (AR)
    def revalue_receivables
      unpaid_foreign_invoices.each do |invoice|
        revalue_invoice(invoice)
      end
    end

    # Revalue a single invoice
    def revalue_invoice(invoice)
      return unless invoice.currency_code != base_currency.code

      currency = Gl::Currency.find_by(
        corporate: corporate,
        code: invoice.currency_code
      )
      return unless currency

      # Outstanding amount in foreign currency
      outstanding_foreign = invoice.amount_due

      # Original base value (at invoice date)
      original_result = converter.to_base(
        outstanding_foreign,
        from_currency: currency,
        date: invoice.invoice_date
      )
      original_base = original_result[:amount]

      # Current base value
      current_result = converter.to_base(
        outstanding_foreign,
        from_currency: currency,
        date: revaluation_date
      )
      current_base = current_result[:amount]

      gain_loss = current_base - original_base
      return if gain_loss.abs < 0.01

      @revaluations << {
        type: 'receivable',
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        contact_name: invoice.contact&.name,
        currency: currency.code,
        foreign_outstanding: outstanding_foreign,
        original_base_value: original_base,
        current_base_value: current_base,
        gain_loss: gain_loss,
        gain_loss_type: gain_loss.positive? ? 'gain' : 'loss',
        original_date: invoice.invoice_date,
        original_rate: original_result[:rate],
        current_rate: current_result[:rate]
      }
    end

    # Revalue unpaid foreign currency bills (AP)
    def revalue_payables
      unpaid_foreign_bills.each do |bill|
        revalue_bill(bill)
      end
    end

    # Revalue a single bill
    def revalue_bill(bill)
      return unless bill.currency_code != base_currency.code

      currency = Gl::Currency.find_by(
        corporate: corporate,
        code: bill.currency_code
      )
      return unless currency

      # Outstanding amount in foreign currency
      outstanding_foreign = bill.amount_due

      # Original base value (at bill date)
      original_result = converter.to_base(
        outstanding_foreign,
        from_currency: currency,
        date: bill.invoice_date # Bills use invoice_date field
      )
      original_base = original_result[:amount]

      # Current base value
      current_result = converter.to_base(
        outstanding_foreign,
        from_currency: currency,
        date: revaluation_date
      )
      current_base = current_result[:amount]

      # For payables, a decrease in liability is a gain
      # If we owe less in AUD terms, that's a gain
      gain_loss = original_base - current_base
      return if gain_loss.abs < 0.01

      @revaluations << {
        type: 'payable',
        bill_id: bill.id,
        bill_number: bill.invoice_number,
        contact_name: bill.contact&.name,
        currency: currency.code,
        foreign_outstanding: outstanding_foreign,
        original_base_value: original_base,
        current_base_value: current_base,
        gain_loss: gain_loss,
        gain_loss_type: gain_loss.positive? ? 'gain' : 'loss',
        original_date: bill.invoice_date,
        original_rate: original_result[:rate],
        current_rate: current_result[:rate]
      }
    end

    # Create journal entry for all revaluations
    def create_revaluation_journal
      return nil if total_gain_loss.zero?

      period = find_or_create_period(revaluation_date)

      journal = Gl::JournalEntry.create!(
        corporate: corporate,
        gl_period: period,
        entry_date: revaluation_date,
        description: "Currency revaluation as at #{revaluation_date.strftime('%d %b %Y')}",
        source_type: 'currency_revaluation',
        status: 'posted'
      )

      # Create lines for each revaluation
      @revaluations.each do |reval|
        account = find_account_for_revaluation(reval)
        next unless account

        gain_loss_account = reval[:gain_loss].positive? ? exchange_gain_account : exchange_loss_account
        amount = reval[:gain_loss].abs

        if reval[:gain_loss].positive?
          # Gain: DR Account, CR Exchange Gain
          journal.ledger_lines.create!(
            gl_account: account,
            debit: amount,
            credit: 0,
            description: "Revaluation: #{reval[:currency]} #{reval[:type]}"
          )
          journal.ledger_lines.create!(
            gl_account: gain_loss_account,
            debit: 0,
            credit: amount,
            description: "Exchange gain on #{reval[:type]}"
          )
        else
          # Loss: DR Exchange Loss, CR Account
          journal.ledger_lines.create!(
            gl_account: gain_loss_account,
            debit: amount,
            credit: 0,
            description: "Exchange loss on #{reval[:type]}"
          )
          journal.ledger_lines.create!(
            gl_account: account,
            debit: 0,
            credit: amount,
            description: "Revaluation: #{reval[:currency]} #{reval[:type]}"
          )
        end
      end

      # Update totals
      journal.update!(
        total_debits: journal.ledger_lines.sum(:debit),
        total_credits: journal.ledger_lines.sum(:credit)
      )

      journal
    end

    # Preview revaluation without creating journals
    def preview
      @revaluations = []
      revalue_bank_accounts
      revalue_receivables
      revalue_payables

      {
        revaluation_date: revaluation_date,
        preview: true,
        revaluations: @revaluations,
        summary: {
          bank_accounts: bank_account_summary,
          receivables: receivables_summary,
          payables: payables_summary,
          total_gain: total_gains,
          total_loss: total_losses,
          net_gain_loss: total_gain_loss
        }
      }
    end

    private

    def base_currency
      @base_currency ||= Gl::Currency.base_currency_for(corporate)
    end

    def foreign_bank_accounts
      Gl::Account
        .where(corporate: corporate)
        .where(is_bank_account: true)
        .where(active: true)
        .where.not(currency_code: [nil, '', base_currency.code])
    end

    def unpaid_foreign_invoices
      Gl::Invoice
        .where(corporate: corporate)
        .where(invoice_type: 'sales_invoice')
        .where(status: %w[approved submitted])
        .where.not(currency_code: [nil, '', base_currency.code])
    end

    def unpaid_foreign_bills
      Gl::Invoice
        .where(corporate: corporate)
        .where(invoice_type: 'bill')
        .where(status: %w[approved submitted])
        .where.not(currency_code: [nil, '', base_currency.code])
    end

    def current_balance_for(account)
      # Calculate current balance from ledger lines
      Gl::LedgerLine
        .joins(:gl_journal_entry)
        .where(gl_account: account)
        .where('gl_journal_entries.entry_date <= ?', revaluation_date)
        .sum('debit - credit')
    end

    def original_base_value_for(account)
      # This would need tracking of original rates per transaction
      # For now, use a simplified approach
      current_balance_for(account)
    end

    def find_account_for_revaluation(reval)
      case reval[:type]
      when 'bank_account'
        Gl::Account.find_by(id: reval[:account_id])
      when 'receivable'
        accounts_receivable
      when 'payable'
        accounts_payable
      end
    end

    def accounts_receivable
      @ar ||= Gl::Account.find_by(
        corporate: corporate,
        system_account: 'accounts_receivable'
      )
    end

    def accounts_payable
      @ap ||= Gl::Account.find_by(
        corporate: corporate,
        system_account: 'accounts_payable'
      )
    end

    def exchange_gain_account
      @gain_account ||= Gl::Account.find_or_create_by!(
        corporate: corporate,
        system_account: EXCHANGE_GAIN_ACCOUNT
      ) do |a|
        a.code = '8100'
        a.name = 'Foreign Exchange Gain'
        a.account_type = 'revenue'
        a.account_class = 'other_income'
      end
    end

    def exchange_loss_account
      @loss_account ||= Gl::Account.find_or_create_by!(
        corporate: corporate,
        system_account: EXCHANGE_LOSS_ACCOUNT
      ) do |a|
        a.code = '6100'
        a.name = 'Foreign Exchange Loss'
        a.account_type = 'expense'
        a.account_class = 'other_expense'
      end
    end

    def find_or_create_period(date)
      # Find or create period for the date
      Gl::Period.find_by(
        corporate: corporate,
        period_start: date.beginning_of_month,
        period_end: date.end_of_month
      ) || create_period_for(date)
    end

    def create_period_for(date)
      # Determine financial year (Australian: July to June)
      fy_year = date.month >= 7 ? date.year + 1 : date.year
      period_number = ((date.month - 7) % 12) + 1

      Gl::Period.create!(
        corporate: corporate,
        financial_year: "FY#{fy_year}",
        period_number: period_number,
        period_name: date.strftime('%B %Y'),
        period_start: date.beginning_of_month,
        period_end: date.end_of_month,
        status: 'open'
      )
    end

    def bank_account_summary
      items = @revaluations.select { |r| r[:type] == 'bank_account' }
      {
        count: items.length,
        total_gain_loss: items.sum { |r| r[:gain_loss] }
      }
    end

    def receivables_summary
      items = @revaluations.select { |r| r[:type] == 'receivable' }
      {
        count: items.length,
        total_gain_loss: items.sum { |r| r[:gain_loss] }
      }
    end

    def payables_summary
      items = @revaluations.select { |r| r[:type] == 'payable' }
      {
        count: items.length,
        total_gain_loss: items.sum { |r| r[:gain_loss] }
      }
    end

    def total_gains
      @revaluations
        .select { |r| r[:gain_loss].positive? }
        .sum { |r| r[:gain_loss] }
    end

    def total_losses
      @revaluations
        .select { |r| r[:gain_loss].negative? }
        .sum { |r| r[:gain_loss].abs }
    end

    def total_gain_loss
      @revaluations.sum { |r| r[:gain_loss] }
    end
  end
end
