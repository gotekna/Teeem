# frozen_string_literal: true

module Gl
  # Company Tax Return Preparation Service
  #
  # Prepares data for Australian company tax returns including:
  # - Assessable income calculation
  # - Allowable deductions
  # - Tax payable/refundable calculation
  # - Reconciliation with accounting profit
  # - PAYG instalment reconciliation
  #
  # Supports:
  # - Companies (25% or 30% rate)
  # - Small Business Entity concessions
  # - Carried forward losses
  #
  class TaxReturnService
    attr_reader :corporate, :financial_year, :options

    # Australian company tax rates (2024-25)
    TAX_RATES = {
      base_rate_entity: 0.25,    # Base rate entities (under $50M turnover, <80% passive income)
      standard: 0.30             # Standard company rate
    }.freeze

    # Tax-related labels for ATO return
    INCOME_LABELS = {
      gross_payments: 'Label 6A - Gross payments subject to withholding',
      gross_interest: 'Label 6B - Gross interest',
      gross_dividends: 'Label 6C - Gross dividends',
      gross_rent: 'Label 6D - Gross rent and other leasing and hiring income',
      other_income: 'Label 6E - Other gross income',
      total_income: 'Label 6G - Total income'
    }.freeze

    DEDUCTION_LABELS = {
      cost_of_sales: 'Label 7A - Cost of sales',
      contractor_payments: 'Label 7B - Contractor, sub-contractor and commission expenses',
      superannuation: 'Label 7C - Superannuation expenses',
      bad_debts: 'Label 7D - Bad debts',
      lease_rental: 'Label 7E - Lease expenses within Australia',
      interest_expenses: 'Label 7F - Interest expenses within Australia',
      depreciation: 'Label 7G - Depreciation expenses',
      motor_vehicle: 'Label 7H - Motor vehicle expenses',
      repairs: 'Label 7I - Repairs and maintenance',
      other_expenses: 'Label 7J - All other expenses',
      total_deductions: 'Label 7K - Total deductions'
    }.freeze

    def initialize(corporate, financial_year = nil, options = {})
      @corporate = corporate
      @financial_year = financial_year || current_fy
      @options = options.with_indifferent_access
    end

    # Generate complete tax return preparation
    def generate
      {
        financial_year: financial_year,
        entity: entity_info,
        income: income_section,
        deductions: deductions_section,
        reconciliation: profit_reconciliation,
        tax_calculation: tax_calculation,
        losses: loss_schedule,
        payg_reconciliation: payg_reconciliation,
        franking_account: franking_account,
        due_dates: due_dates,
        notes: preparation_notes
      }
    end

    # Get just the tax calculation
    def tax_summary
      {
        financial_year: financial_year,
        taxable_income: calculate_taxable_income,
        tax_rate: applicable_tax_rate,
        tax_payable: calculate_tax_payable,
        payg_credits: calculate_payg_credits,
        net_tax_payable: calculate_net_tax_payable
      }
    end

    # Estimate tax payable (for planning)
    def estimate
      taxable = calculate_taxable_income
      rate = applicable_tax_rate
      tax = (taxable * rate).round(2)
      payg = calculate_payg_credits

      {
        estimated_taxable_income: taxable,
        estimated_tax: tax,
        payg_instalments_paid: payg,
        estimated_payable: (tax - payg).round(2),
        estimated_refund: payg > tax ? (payg - tax).round(2) : 0
      }
    end

    private

    # =========================================================================
    # ENTITY INFORMATION
    # =========================================================================

    def entity_info
      {
        name: corporate.name,
        abn: corporate.abn,
        acn: corporate.acn,
        entity_type: entity_type,
        tax_rate: applicable_tax_rate,
        is_base_rate_entity: base_rate_entity?,
        is_small_business: small_business_entity?,
        aggregated_turnover: calculate_aggregated_turnover
      }
    end

    def entity_type
      # Would come from company settings
      options[:entity_type] || 'company'
    end

    def base_rate_entity?
      # Base rate entity: turnover < $50M and <80% passive income
      turnover = calculate_aggregated_turnover
      passive_pct = calculate_passive_income_percentage

      turnover < 50_000_000 && passive_pct < 80
    end

    def small_business_entity?
      calculate_aggregated_turnover < 10_000_000
    end

    def applicable_tax_rate
      base_rate_entity? ? TAX_RATES[:base_rate_entity] : TAX_RATES[:standard]
    end

    # =========================================================================
    # INCOME SECTION (Labels 6A-6G)
    # =========================================================================

    def income_section
      {
        gross_payments: calculate_gross_payments,
        gross_interest: calculate_gross_interest,
        gross_dividends: calculate_gross_dividends,
        gross_rent: calculate_gross_rent,
        other_income: calculate_other_income,
        total_income: calculate_total_income,
        labels: INCOME_LABELS
      }
    end

    def calculate_gross_payments
      # Sales revenue (subject to withholding - building/construction industry)
      sales_accounts = Gl::Account.where(
        corporate: corporate,
        account_type: 'revenue',
        account_class: %w[sales_revenue service_revenue]
      )

      sales_accounts.sum { |a| account_fy_balance(a).abs }.to_d.round(2)
    end

    def calculate_gross_interest
      interest_accounts = Gl::Account.where(
        corporate: corporate,
        account_type: 'revenue',
        name: ['Interest Income', 'Interest Received', 'Bank Interest']
      )

      interest_accounts.sum { |a| account_fy_balance(a).abs }.to_d.round(2)
    end

    def calculate_gross_dividends
      dividend_accounts = Gl::Account.where(
        corporate: corporate,
        account_type: 'revenue',
        name: ['Dividend Income', 'Dividends Received']
      )

      dividend_accounts.sum { |a| account_fy_balance(a).abs }.to_d.round(2)
    end

    def calculate_gross_rent
      rent_accounts = Gl::Account.where(
        corporate: corporate,
        account_type: 'revenue',
        name: ['Rental Income', 'Lease Income']
      )

      rent_accounts.sum { |a| account_fy_balance(a).abs }.to_d.round(2)
    end

    def calculate_other_income
      other_accounts = Gl::Account.where(
        corporate: corporate,
        account_type: 'revenue',
        account_class: 'other_income'
      )

      other_accounts.sum { |a| account_fy_balance(a).abs }.to_d.round(2)
    end

    def calculate_total_income
      revenue_accounts = Gl::Account.where(
        corporate: corporate,
        account_type: 'revenue'
      )

      revenue_accounts.sum { |a| account_fy_balance(a).abs }.to_d.round(2)
    end

    # =========================================================================
    # DEDUCTIONS SECTION (Labels 7A-7K)
    # =========================================================================

    def deductions_section
      {
        cost_of_sales: calculate_cost_of_sales,
        contractor_payments: calculate_contractor_payments,
        superannuation: calculate_superannuation,
        bad_debts: calculate_bad_debts,
        lease_rental: calculate_lease_expenses,
        interest_expenses: calculate_interest_expenses,
        depreciation: calculate_depreciation,
        motor_vehicle: calculate_motor_vehicle,
        repairs: calculate_repairs,
        other_expenses: calculate_other_expenses,
        total_deductions: calculate_total_deductions,
        labels: DEDUCTION_LABELS
      }
    end

    def calculate_cost_of_sales
      cos_accounts = Gl::Account.where(
        corporate: corporate,
        account_type: 'expense',
        account_class: %w[cost_of_sales direct_costs]
      )

      cos_accounts.sum { |a| account_fy_balance(a).abs }.to_d.round(2)
    end

    def calculate_contractor_payments
      contractor_accounts = Gl::Account.where(
        corporate: corporate,
        account_type: 'expense',
        account_class: %w[subcontractors contractors]
      )

      contractor_accounts.sum { |a| account_fy_balance(a).abs }.to_d.round(2)
    end

    def calculate_superannuation
      super_accounts = Gl::Account.where(
        corporate: corporate,
        account_type: 'expense',
        account_class: 'superannuation'
      )

      super_accounts.sum { |a| account_fy_balance(a).abs }.to_d.round(2)
    end

    def calculate_bad_debts
      bad_debt_accounts = Gl::Account.where(
        corporate: corporate,
        account_type: 'expense',
        name: ['Bad Debts', 'Bad Debt Expense', 'Doubtful Debts']
      )

      bad_debt_accounts.sum { |a| account_fy_balance(a).abs }.to_d.round(2)
    end

    def calculate_lease_expenses
      lease_accounts = Gl::Account.where(
        corporate: corporate,
        account_type: 'expense',
        name: ['Rent', 'Lease Expense', 'Equipment Hire', 'Office Rent']
      )

      lease_accounts.sum { |a| account_fy_balance(a).abs }.to_d.round(2)
    end

    def calculate_interest_expenses
      interest_accounts = Gl::Account.where(
        corporate: corporate,
        account_type: 'expense',
        name: ['Interest Expense', 'Interest Paid', 'Bank Charges', 'Loan Interest']
      )

      interest_accounts.sum { |a| account_fy_balance(a).abs }.to_d.round(2)
    end

    def calculate_depreciation
      depreciation_accounts = Gl::Account.where(
        corporate: corporate,
        account_type: 'expense',
        account_class: 'depreciation'
      )

      depreciation_accounts.sum { |a| account_fy_balance(a).abs }.to_d.round(2)
    end

    def calculate_motor_vehicle
      mv_accounts = Gl::Account.where(
        corporate: corporate,
        account_type: 'expense',
        name: ['Motor Vehicle Expenses', 'Vehicle Running Costs', 'Fuel', 'Car Expenses']
      )

      mv_accounts.sum { |a| account_fy_balance(a).abs }.to_d.round(2)
    end

    def calculate_repairs
      repairs_accounts = Gl::Account.where(
        corporate: corporate,
        account_type: 'expense',
        name: ['Repairs & Maintenance', 'Repairs', 'Maintenance']
      )

      repairs_accounts.sum { |a| account_fy_balance(a).abs }.to_d.round(2)
    end

    def calculate_other_expenses
      # All expenses not captured elsewhere
      specific_deductions = calculate_cost_of_sales + calculate_contractor_payments +
        calculate_superannuation + calculate_bad_debts + calculate_lease_expenses +
        calculate_interest_expenses + calculate_depreciation + calculate_motor_vehicle +
        calculate_repairs

      total = calculate_total_deductions
      (total - specific_deductions).to_d.round(2)
    end

    def calculate_total_deductions
      expense_accounts = Gl::Account.where(
        corporate: corporate,
        account_type: 'expense'
      )

      expense_accounts.sum { |a| account_fy_balance(a).abs }.to_d.round(2)
    end

    # =========================================================================
    # PROFIT RECONCILIATION
    # =========================================================================

    def profit_reconciliation
      accounting_profit = calculate_accounting_profit

      # Adjustments for tax purposes
      add_backs = calculate_add_backs
      deductions = calculate_extra_deductions

      taxable_income = accounting_profit + add_backs[:total] - deductions[:total]

      {
        accounting_profit: accounting_profit.to_d.round(2),
        add_backs: add_backs,
        less_deductions: deductions,
        taxable_income: taxable_income.to_d.round(2),
        prior_year_losses_applied: apply_prior_losses(taxable_income),
        final_taxable_income: calculate_taxable_income.to_d.round(2)
      }
    end

    def calculate_accounting_profit
      income = calculate_total_income
      expenses = calculate_total_deductions
      income - expenses
    end

    def calculate_add_backs
      # Non-deductible items that need to be added back
      items = []

      # Entertainment (50% non-deductible)
      entertainment = Gl::Account.where(
        corporate: corporate,
        name: ['Entertainment', 'Meals & Entertainment']
      ).sum { |a| account_fy_balance(a).abs } * 0.5

      items << { description: 'Entertainment (50% non-deductible)', amount: entertainment } if entertainment > 0

      # Penalties and fines
      penalties = Gl::Account.where(
        corporate: corporate,
        name: ['Penalties', 'Fines', 'ATO Penalties']
      ).sum { |a| account_fy_balance(a).abs }

      items << { description: 'Penalties and fines', amount: penalties } if penalties > 0

      # Private use
      private_use = options[:private_use_adjustment] || 0
      items << { description: 'Private use adjustments', amount: private_use } if private_use > 0

      {
        items: items,
        total: items.sum { |i| i[:amount] }.to_d.round(2)
      }
    end

    def calculate_extra_deductions
      # Deductions not in accounting records
      items = []

      # Instant asset write-off (SBE)
      if small_business_entity?
        instant_writeoff = options[:instant_asset_writeoff] || 0
        items << { description: 'Instant asset write-off (SBE)', amount: instant_writeoff } if instant_writeoff > 0
      end

      # R&D incentive
      rd_incentive = options[:rd_incentive] || 0
      items << { description: 'R&D Tax Incentive', amount: rd_incentive } if rd_incentive > 0

      {
        items: items,
        total: items.sum { |i| i[:amount] }.to_d.round(2)
      }
    end

    # =========================================================================
    # TAX CALCULATION
    # =========================================================================

    def tax_calculation
      taxable = calculate_taxable_income
      rate = applicable_tax_rate
      gross_tax = (taxable * rate).round(2)

      # Offsets/credits
      franking_credits = calculate_franking_credits
      r_d_offset = options[:rd_offset] || 0

      tax_payable = [gross_tax - franking_credits - r_d_offset, 0].max

      # PAYG credits
      payg = calculate_payg_credits
      net_payable = tax_payable - payg

      {
        taxable_income: taxable.to_d.round(2),
        tax_rate: (rate * 100).round(1),
        gross_tax: gross_tax.to_d.round(2),
        less_offsets: {
          franking_credits: franking_credits.to_d.round(2),
          rd_offset: r_d_offset.to_d.round(2)
        },
        tax_payable: tax_payable.to_d.round(2),
        less_payg_credits: payg.to_d.round(2),
        net_tax_payable: net_payable.to_d.round(2),
        refund_due: net_payable < 0 ? net_payable.abs.to_d.round(2) : 0.to_d
      }
    end

    def calculate_taxable_income
      profit = profit_reconciliation
      losses = apply_prior_losses(profit[:taxable_income])

      [profit[:taxable_income] - losses, 0].max
    end

    def calculate_tax_payable
      taxable = calculate_taxable_income
      (taxable * applicable_tax_rate).round(2)
    end

    def calculate_net_tax_payable
      tax = calculate_tax_payable
      payg = calculate_payg_credits
      franking = calculate_franking_credits

      tax - payg - franking
    end

    def calculate_payg_credits
      # Sum of PAYG instalments paid during the year
      # Would come from BAS records or manual entry
      options[:payg_instalments_paid] || 0.to_d
    end

    def calculate_franking_credits
      # Franking credits from dividends received
      # Gross up = Dividend / (1 - tax rate)
      dividends = calculate_gross_dividends
      franking_rate = options[:franking_rate] || 0.30 # Assume fully franked at 30%

      (dividends * franking_rate / (1 - franking_rate)).round(2)
    end

    # =========================================================================
    # LOSS SCHEDULE
    # =========================================================================

    def loss_schedule
      prior_losses = get_prior_year_losses
      current_loss = calculate_accounting_profit < 0 ? calculate_accounting_profit.abs : 0
      applied = apply_prior_losses(profit_reconciliation[:taxable_income])
      carried_forward = prior_losses - applied + current_loss

      {
        prior_year_losses: prior_losses.to_d.round(2),
        losses_applied: applied.to_d.round(2),
        current_year_loss: current_loss.to_d.round(2),
        carried_forward: carried_forward.to_d.round(2),
        note: 'Losses can be carried forward indefinitely subject to continuity of ownership or same business tests'
      }
    end

    def get_prior_year_losses
      # Would retrieve from stored loss records
      options[:prior_year_losses] || 0.to_d
    end

    def apply_prior_losses(taxable_income)
      prior = get_prior_year_losses
      return 0 if prior.zero? || taxable_income <= 0

      # Apply losses up to taxable income
      [prior, taxable_income].min
    end

    # =========================================================================
    # PAYG RECONCILIATION
    # =========================================================================

    def payg_reconciliation
      instalments = calculate_payg_instalments_by_quarter
      total_paid = instalments.sum { |q| q[:amount] }
      tax_liability = calculate_tax_payable

      {
        quarters: instalments,
        total_instalments_paid: total_paid.to_d.round(2),
        estimated_tax_liability: tax_liability.to_d.round(2),
        variance: (tax_liability - total_paid).to_d.round(2),
        note: variance_note(tax_liability, total_paid)
      }
    end

    def calculate_payg_instalments_by_quarter
      %w[Q1 Q2 Q3 Q4].map do |quarter|
        # Would retrieve from BAS records
        {
          quarter: quarter,
          amount: (options.dig(:payg_by_quarter, quarter) || 0).to_d.round(2)
        }
      end
    end

    def variance_note(tax, paid)
      variance = tax - paid
      if variance > 0
        "Additional payment of $#{variance.round(2)} will be required"
      elsif variance < 0
        "Refund of $#{variance.abs.round(2)} expected"
      else
        'PAYG instalments equal tax liability - no variance'
      end
    end

    # =========================================================================
    # FRANKING ACCOUNT
    # =========================================================================

    def franking_account
      opening = options[:franking_opening_balance] || 0
      tax_paid = calculate_tax_payable
      dividends_paid = options[:dividends_paid] || 0
      franking_on_dividends = (dividends_paid * 0.30 / 0.70).round(2) # Fully franked

      closing = opening + tax_paid - franking_on_dividends

      {
        opening_balance: opening.to_d.round(2),
        add_tax_paid: tax_paid.to_d.round(2),
        less_franking_credits_attached: franking_on_dividends.to_d.round(2),
        closing_balance: closing.to_d.round(2),
        note: closing < 0 ? 'Warning: Franking deficit - may trigger FDT' : nil
      }
    end

    # =========================================================================
    # DUE DATES
    # =========================================================================

    def due_dates
      fy_year = financial_year.delete('FY').to_i

      {
        financial_year_end: Date.new(fy_year, 6, 30),
        lodgement_due: {
          self_lodger: Date.new(fy_year + 1, 2, 28),
          tax_agent: Date.new(fy_year + 1, 5, 15),
          note: 'Tax agent lodgement date may vary based on agent schedule'
        },
        payment_due: Date.new(fy_year + 1, 12, 1),
        note: 'Payment is due on the later of 21 days after notice or 1 December'
      }
    end

    # =========================================================================
    # HELPERS
    # =========================================================================

    def current_fy
      today = Date.current
      year = today.month >= 7 ? today.year + 1 : today.year
      "FY#{year}"
    end

    def fy_start_date
      year = financial_year.delete('FY').to_i - 1
      Date.new(year, 7, 1)
    end

    def fy_end_date
      year = financial_year.delete('FY').to_i
      Date.new(year, 6, 30)
    end

    def account_fy_balance(account)
      Gl::LedgerLine
        .joins(:gl_journal_entry)
        .where(gl_account: account)
        .where(gl_journal_entries: { corporate: corporate })
        .where('gl_journal_entries.entry_date >= ? AND gl_journal_entries.entry_date <= ?', fy_start_date, fy_end_date)
        .sum('debit - credit')
    end

    def calculate_aggregated_turnover
      # Current year turnover
      revenue_accounts = Gl::Account.where(
        corporate: corporate,
        account_type: 'revenue'
      )

      revenue_accounts.sum { |a| account_fy_balance(a).abs }
    end

    def calculate_passive_income_percentage
      # Passive = interest, dividends, rent, royalties, net capital gains
      total_income = calculate_total_income
      return 0 if total_income.zero?

      passive = calculate_gross_interest + calculate_gross_dividends + calculate_gross_rent
      ((passive / total_income) * 100).round(1)
    end

    def preparation_notes
      notes = []

      notes << 'This is a draft tax calculation for planning purposes only.'
      notes << 'Amounts should be verified by a registered tax agent before lodgement.'

      if base_rate_entity?
        notes << "Company qualifies as a Base Rate Entity (#{(TAX_RATES[:base_rate_entity] * 100).round(0)}% tax rate)"
      end

      if small_business_entity?
        notes << 'Company qualifies as a Small Business Entity - eligible for SBE concessions'
      end

      prior = get_prior_year_losses
      if prior > 0
        notes << "Carried forward losses of $#{prior.round(2)} available"
      end

      notes
    end
  end
end
