# frozen_string_literal: true

module Gl
  # Business Activity Statement (BAS) Preparation Service
  #
  # Prepares quarterly BAS data for Australian tax lodgement including:
  # - GST on sales (1A) and purchases (1B)
  # - GST-free and input-taxed supplies
  # - PAYG withholding (W1, W2)
  # - PAYG instalments (T7, T8, T9)
  # - Full reconciliation with GL balances
  #
  # Supports both quarterly and monthly BAS lodgement.
  #
  class BasPreparationService
    attr_reader :corporate_company, :period_start, :period_end, :options

    # BAS reporting periods for Australian FY (July-June)
    BAS_QUARTERS = {
      'Q1' => { months: [7, 8, 9], label: 'Q1 (Jul-Sep)' },
      'Q2' => { months: [10, 11, 12], label: 'Q2 (Oct-Dec)' },
      'Q3' => { months: [1, 2, 3], label: 'Q3 (Jan-Mar)' },
      'Q4' => { months: [4, 5, 6], label: 'Q4 (Apr-Jun)' }
    }.freeze

    # GST rate in Australia
    GST_RATE = 0.10

    def initialize(corporate_company, options = {})
      @corporate_company = corporate_company
      @period_start = options[:period_start] || default_quarter_start
      @period_end = options[:period_end] || default_quarter_end
      @options = options.with_indifferent_access
    end

    # Generate complete BAS preparation data
    def generate
      {
        bas_period: period_info,
        generated_at: Time.current,
        gst_section: gst_section,
        payg_withholding: payg_withholding_section,
        payg_instalments: payg_instalments_section,
        summary: calculate_summary,
        reconciliation: reconciliation,
        validation: validation_checks,
        notes: generate_notes
      }
    end

    # Get just the GST section
    def gst_only
      {
        period: period_info,
        gst: gst_section,
        reconciliation: gst_reconciliation
      }
    end

    # Get just PAYG sections
    def payg_only
      {
        period: period_info,
        withholding: payg_withholding_section,
        instalments: payg_instalments_section
      }
    end

    # Preview what will be reported
    def preview
      {
        period: period_info,
        amounts: {
          gst_on_sales: gst_on_sales[:amount],
          gst_on_purchases: gst_on_purchases[:amount],
          net_gst: gst_on_sales[:amount] - gst_on_purchases[:amount],
          payg_withheld: payg_withholding_section[:w2_tax_withheld],
          payg_instalment: payg_instalments_section[:t9_instalment_amount]
        },
        invoice_count: period_invoices.count,
        bill_count: period_bills.count
      }
    end

    private

    # =========================================================================
    # GST SECTION (Labels G1-G20, 1A, 1B)
    # =========================================================================

    def gst_section
      sales = gst_on_sales
      purchases = gst_on_purchases

      {
        # Sales side
        g1_total_sales: sales[:g1_total_sales],
        g2_export_sales: sales[:g2_export_sales],
        g3_gst_free_sales: sales[:g3_gst_free_sales],
        g4_input_taxed_sales: sales[:g4_input_taxed_sales],
        g5_total_non_taxable: sales[:g2_export_sales] + sales[:g3_gst_free_sales] + sales[:g4_input_taxed_sales],
        g6_taxable_sales: sales[:g6_taxable_sales],
        g7_adjustments: sales[:g7_adjustments],
        g8_total_taxable_sales: sales[:g8_total_taxable_sales],
        g9_gst_on_sales: sales[:g9_gst_on_sales],

        # Purchases side
        g10_capital_purchases: purchases[:g10_capital_purchases],
        g11_non_capital_purchases: purchases[:g11_non_capital_purchases],
        g12_total_purchases: purchases[:g10_capital_purchases] + purchases[:g11_non_capital_purchases],
        g13_input_taxed_purchases: purchases[:g13_input_taxed_purchases],
        g14_no_gst_credit_purchases: purchases[:g14_no_gst_credit_purchases],
        g15_private_use: purchases[:g15_private_use],
        g16_total_non_creditable: purchases[:g13_input_taxed_purchases] + purchases[:g14_no_gst_credit_purchases] + purchases[:g15_private_use],
        g17_creditable_purchases: purchases[:g17_creditable_purchases],
        g18_adjustments: purchases[:g18_adjustments],
        g19_total_creditable: purchases[:g19_total_creditable],
        g20_gst_on_purchases: purchases[:g20_gst_on_purchases],

        # Summary labels for ATO form
        label_1a_gst_on_sales: sales[:amount],
        label_1b_gst_on_purchases: purchases[:amount],
        net_gst: sales[:amount] - purchases[:amount],

        # Breakdown by tax type
        by_tax_type: {
          sales: sales[:by_tax_type],
          purchases: purchases[:by_tax_type]
        }
      }
    end

    def gst_on_sales
      invoices = period_invoices

      # Calculate totals by tax type
      by_tax_type = calculate_tax_breakdown(invoices)

      total_sales_incl_gst = invoices.sum(&:total)
      gst_collected = invoices.sum { |inv| inv.line_items.sum { |li| li.tax_amount || 0 } }

      gst_free = by_tax_type['GST Free Income']&.dig(:total) || 0
      export_sales = by_tax_type['GST on Exports']&.dig(:total) || 0
      input_taxed = by_tax_type['Input Taxed Income']&.dig(:total) || 0

      taxable_sales = total_sales_incl_gst - gst_free - export_sales - input_taxed

      # GST adjustments (credit notes, etc.)
      credit_notes = period_credit_notes_sales
      adjustments = credit_notes.sum { |cn| cn.line_items.sum { |li| li.tax_amount || 0 } }

      {
        amount: (gst_collected - adjustments).to_d.round(2),
        g1_total_sales: total_sales_incl_gst.to_d.round(2),
        g2_export_sales: export_sales.to_d.round(2),
        g3_gst_free_sales: gst_free.to_d.round(2),
        g4_input_taxed_sales: input_taxed.to_d.round(2),
        g6_taxable_sales: taxable_sales.to_d.round(2),
        g7_adjustments: adjustments.to_d.round(2),
        g8_total_taxable_sales: (taxable_sales - adjustments).to_d.round(2),
        g9_gst_on_sales: gst_collected.to_d.round(2),
        invoice_count: invoices.count,
        by_tax_type: by_tax_type
      }
    end

    def gst_on_purchases
      bills = period_bills

      by_tax_type = calculate_tax_breakdown(bills)

      # Separate capital vs non-capital (simplified - would need account classification)
      total_purchases = bills.sum(&:total)
      gst_paid = bills.sum { |bill| bill.line_items.sum { |li| li.tax_amount || 0 } }

      # Capital purchases - would typically be coded to asset accounts
      capital = bills.select { |b| b.line_items.any? { |li| capital_account?(li.account_id) } }
      capital_total = capital.sum(&:total)
      non_capital_total = total_purchases - capital_total

      # Non-creditable GST
      no_credit = by_tax_type['BAS Excluded']&.dig(:total) || 0
      input_taxed = by_tax_type['Input Taxed Purchases']&.dig(:total) || 0

      creditable = total_purchases - no_credit - input_taxed

      # Adjustments from credit notes
      credit_notes = period_credit_notes_purchases
      adjustments = credit_notes.sum { |cn| cn.line_items.sum { |li| li.tax_amount || 0 } }

      {
        amount: (gst_paid - adjustments).to_d.round(2),
        g10_capital_purchases: capital_total.to_d.round(2),
        g11_non_capital_purchases: non_capital_total.to_d.round(2),
        g13_input_taxed_purchases: input_taxed.to_d.round(2),
        g14_no_gst_credit_purchases: no_credit.to_d.round(2),
        g15_private_use: 0.to_d, # Would need tracking for private use
        g17_creditable_purchases: creditable.to_d.round(2),
        g18_adjustments: adjustments.to_d.round(2),
        g19_total_creditable: (creditable - adjustments).to_d.round(2),
        g20_gst_on_purchases: gst_paid.to_d.round(2),
        bill_count: bills.count,
        by_tax_type: by_tax_type
      }
    end

    # =========================================================================
    # PAYG WITHHOLDING SECTION (Labels W1-W5)
    # =========================================================================

    def payg_withholding_section
      # This would integrate with payroll data
      # For now, returning placeholder structure

      {
        w1_total_salary_wages: calculate_salary_wages,
        w2_tax_withheld: calculate_tax_withheld,
        w3_other_withholding: 0.to_d,
        w4_total_withholding: calculate_tax_withheld,
        has_payroll_data: payroll_available?,
        note: payroll_available? ? nil : 'PAYG withholding requires payroll integration'
      }
    end

    # =========================================================================
    # PAYG INSTALMENTS SECTION (Labels T7-T9)
    # =========================================================================

    def payg_instalments_section
      instalment_rate = options[:payg_rate] || default_payg_rate
      instalment_income = calculate_instalment_income

      {
        t7_instalment_income: instalment_income.to_d.round(2),
        t8_instalment_rate: (instalment_rate * 100).round(2),
        t8_rate_decimal: instalment_rate,
        t9_instalment_amount: (instalment_income * instalment_rate).to_d.round(2),
        method: options[:payg_method] || 'instalment_rate',
        note: 'Rate method used. Use T4 (instalment amount) for amount method.'
      }
    end

    # =========================================================================
    # SUMMARY & RECONCILIATION
    # =========================================================================

    def calculate_summary
      gst = gst_section
      payg_wh = payg_withholding_section
      payg_inst = payg_instalments_section

      net_gst = gst[:label_1a_gst_on_sales] - gst[:label_1b_gst_on_purchases]
      total_payable = net_gst + payg_wh[:w4_total_withholding] + payg_inst[:t9_instalment_amount]

      {
        net_gst_payable: net_gst.to_d.round(2),
        payg_withholding_payable: payg_wh[:w4_total_withholding].to_d.round(2),
        payg_instalment_payable: payg_inst[:t9_instalment_amount].to_d.round(2),
        total_payable_to_ato: total_payable.to_d.round(2),
        total_refundable: total_payable < 0 ? total_payable.abs.to_d.round(2) : 0.to_d,
        due_date: bas_due_date,
        lodgement_required: total_payable != 0 || options[:force_lodge]
      }
    end

    def reconciliation
      {
        gst: gst_reconciliation,
        payg: payg_reconciliation,
        overall_status: reconciliation_status
      }
    end

    def gst_reconciliation
      # Compare BAS figures with GL account balances
      gst_collected_account = find_gst_collected_account
      gst_paid_account = find_gst_paid_account

      gst_collected_gl = gst_collected_account ? account_balance_for_period(gst_collected_account) : 0
      gst_paid_gl = gst_paid_account ? account_balance_for_period(gst_paid_account) : 0

      bas_collected = gst_on_sales[:amount]
      bas_paid = gst_on_purchases[:amount]

      collected_diff = (bas_collected - gst_collected_gl).abs
      paid_diff = (bas_paid - gst_paid_gl).abs

      {
        gst_collected: {
          bas_amount: bas_collected,
          gl_balance: gst_collected_gl.to_d.round(2),
          difference: collected_diff.to_d.round(2),
          matches: collected_diff < 0.01
        },
        gst_paid: {
          bas_amount: bas_paid,
          gl_balance: gst_paid_gl.to_d.round(2),
          difference: paid_diff.to_d.round(2),
          matches: paid_diff < 0.01
        },
        status: collected_diff < 0.01 && paid_diff < 0.01 ? 'reconciled' : 'variance'
      }
    end

    def payg_reconciliation
      # Would reconcile with payroll clearing account
      {
        status: payroll_available? ? 'pending' : 'not_applicable',
        note: 'PAYG reconciliation requires payroll integration'
      }
    end

    def reconciliation_status
      gst_recon = gst_reconciliation
      if gst_recon[:status] == 'reconciled'
        'reconciled'
      else
        'variance_detected'
      end
    end

    # =========================================================================
    # VALIDATION
    # =========================================================================

    def validation_checks
      errors = []
      warnings = []

      # Check for unposted transactions
      unposted = unposted_transactions_count
      if unposted > 0
        warnings << "#{unposted} unposted transactions in period - review before lodging"
      end

      # Check GST reconciliation
      gst_recon = gst_reconciliation
      unless gst_recon[:gst_collected][:matches]
        errors << "GST collected doesn't match GL: BAS #{gst_recon[:gst_collected][:bas_amount]}, GL #{gst_recon[:gst_collected][:gl_balance]}"
      end
      unless gst_recon[:gst_paid][:matches]
        errors << "GST paid doesn't match GL: BAS #{gst_recon[:gst_paid][:bas_amount]}, GL #{gst_recon[:gst_paid][:gl_balance]}"
      end

      # Check for unusual amounts
      gst = gst_section
      if gst[:label_1b_gst_on_purchases] > gst[:label_1a_gst_on_sales] * 2
        warnings << 'GST credits significantly higher than GST collected - verify purchases'
      end

      # Check prior period comparison
      prior_summary = prior_period_summary
      if prior_summary
        current_net = gst[:net_gst]
        prior_net = prior_summary[:net_gst]
        variance_pct = prior_net.zero? ? 0 : ((current_net - prior_net).abs / prior_net * 100)
        if variance_pct > 50
          warnings << "Net GST varies #{variance_pct.round(0)}% from prior period - verify accuracy"
        end
      end

      {
        valid: errors.empty?,
        errors: errors,
        warnings: warnings,
        checked_at: Time.current
      }
    end

    # =========================================================================
    # HELPERS
    # =========================================================================

    def period_info
      fy = financial_year
      quarter = current_quarter

      {
        period_start: period_start,
        period_end: period_end,
        financial_year: fy,
        quarter: quarter,
        label: "#{quarter} #{fy}"
      }
    end

    def financial_year
      # Australian FY is July-June
      year = period_end.month >= 7 ? period_end.year + 1 : period_end.year
      "FY#{year}"
    end

    def current_quarter
      month = period_start.month
      case month
      when 7, 8, 9 then 'Q1'
      when 10, 11, 12 then 'Q2'
      when 1, 2, 3 then 'Q3'
      when 4, 5, 6 then 'Q4'
      end
    end

    def default_quarter_start
      # Default to current quarter
      today = Date.current
      month = today.month
      year = today.year

      case month
      when 7..9
        Date.new(year, 7, 1)
      when 10..12
        Date.new(year, 10, 1)
      when 1..3
        Date.new(year, 1, 1)
      else
        Date.new(year, 4, 1)
      end
    end

    def default_quarter_end
      default_quarter_start.end_of_quarter
    end

    def bas_due_date
      # BAS is due 28th of month following quarter end
      # (With later dates for some lodgement methods)
      due = period_end + 1.month
      Date.new(due.year, due.month, 28)
    end

    def period_invoices
      @period_invoices ||= Gl::Invoice
        .where(corporate_company: corporate_company)
        .where(invoice_type: 'sales_invoice')
        .where(status: %w[approved paid])
        .where('invoice_date >= ? AND invoice_date <= ?', period_start, period_end)
        .includes(:line_items)
    end

    def period_bills
      @period_bills ||= Gl::Invoice
        .where(corporate_company: corporate_company)
        .where(invoice_type: 'bill')
        .where(status: %w[approved paid])
        .where('invoice_date >= ? AND invoice_date <= ?', period_start, period_end)
        .includes(:line_items)
    end

    def period_credit_notes_sales
      Gl::Invoice
        .where(corporate_company: corporate_company)
        .where(invoice_type: 'credit_note')
        .where(status: %w[approved paid])
        .where('invoice_date >= ? AND invoice_date <= ?', period_start, period_end)
        .includes(:line_items)
    end

    def period_credit_notes_purchases
      Gl::Invoice
        .where(corporate_company: corporate_company)
        .where(invoice_type: 'bill_credit_note')
        .where(status: %w[approved paid])
        .where('invoice_date >= ? AND invoice_date <= ?', period_start, period_end)
        .includes(:line_items)
    end

    def calculate_tax_breakdown(documents)
      breakdown = {}

      documents.each do |doc|
        doc.line_items.each do |line|
          tax_type = line.tax_type || 'No Tax'
          breakdown[tax_type] ||= { total: 0, tax: 0, count: 0 }
          breakdown[tax_type][:total] += line.amount || 0
          breakdown[tax_type][:tax] += line.tax_amount || 0
          breakdown[tax_type][:count] += 1
        end
      end

      breakdown
    end

    def capital_account?(account_id)
      return false unless account_id

      account = Gl::Account.find_by(id: account_id)
      account && account.account_class.in?(%w[fixed_asset equipment property])
    end

    def find_gst_collected_account
      Gl::Account.find_by(
        corporate_company: corporate_company,
        system_account: 'gst_collected'
      ) || Gl::Account.find_by(
        corporate_company: corporate_company,
        code: '820' # Common GST Collected code
      )
    end

    def find_gst_paid_account
      Gl::Account.find_by(
        corporate_company: corporate_company,
        system_account: 'gst_paid'
      ) || Gl::Account.find_by(
        corporate_company: corporate_company,
        code: '821' # Common GST Paid code
      )
    end

    def account_balance_for_period(account)
      # Sum ledger lines for the period
      Gl::LedgerLine
        .joins(:gl_journal_entry)
        .where(gl_account: account)
        .where(gl_journal_entries: { corporate_company: corporate_company })
        .where('gl_journal_entries.entry_date >= ? AND gl_journal_entries.entry_date <= ?', period_start, period_end)
        .sum('credit - debit')
    end

    def unposted_transactions_count
      Gl::JournalEntry
        .where(corporate_company: corporate_company)
        .where('entry_date >= ? AND entry_date <= ?', period_start, period_end)
        .where(status: 'draft')
        .count
    end

    def calculate_salary_wages
      # Would integrate with payroll system
      # For now, estimate from expense accounts
      expense_accounts = Gl::Account.where(
        corporate_company: corporate_company,
        account_class: 'wages'
      )

      return 0.to_d if expense_accounts.empty?

      Gl::LedgerLine
        .joins(:gl_journal_entry)
        .where(gl_account: expense_accounts)
        .where('gl_journal_entries.entry_date >= ? AND gl_journal_entries.entry_date <= ?', period_start, period_end)
        .sum(:debit)
    end

    def calculate_tax_withheld
      # Would come from payroll system
      # Estimate as ~30% of wages if no payroll integration
      wages = calculate_salary_wages
      payroll_available? ? 0.to_d : (wages * 0.30).round(2)
    end

    def calculate_instalment_income
      # Business income for PAYG instalments
      # Typically assessable income less certain deductions
      revenue_accounts = Gl::Account.where(
        corporate_company: corporate_company,
        account_type: 'revenue'
      )

      Gl::LedgerLine
        .joins(:gl_journal_entry)
        .where(gl_account: revenue_accounts)
        .where('gl_journal_entries.entry_date >= ? AND gl_journal_entries.entry_date <= ?', period_start, period_end)
        .sum(:credit)
    end

    def default_payg_rate
      # Default PAYG instalment rate - would be set per company
      options[:payg_rate] || 0.025 # 2.5% is a common rate
    end

    def payroll_available?
      # Check if payroll integration is available
      # For now, return false until payroll is implemented
      false
    end

    def prior_period_summary
      prior_start = period_start - 3.months
      prior_end = period_end - 3.months

      prior_service = self.class.new(
        corporate_company,
        period_start: prior_start,
        period_end: prior_end
      )

      prior_gst = prior_service.gst_section
      {
        net_gst: prior_gst[:net_gst]
      }
    rescue StandardError
      nil
    end

    def generate_notes
      notes = []

      unless payroll_available?
        notes << 'PAYG Withholding (W1-W2): Enter manually from payroll system'
      end

      if options[:payg_method] != 'instalment_amount'
        notes << 'PAYG Instalments: Using rate method (T7-T9). If using amount method, enter T4 manually.'
      end

      notes << "GST calculated on #{options[:gst_basis] || 'accrual'} basis"
      notes << "Report generated #{Time.current.strftime('%d/%m/%Y %H:%M')}"

      notes
    end
  end
end
