# frozen_string_literal: true

module Gl
  # Service for tracking and calculating job costs from the GL
  #
  # Provides:
  # - Actual cost tracking from journal entries
  # - Budget vs actual comparison
  # - Cost breakdown by account/category
  # - WIP (Work in Progress) calculation
  # - Cost to complete estimates
  #
  class JobCostingService
    attr_reader :job, :corporate_company

    # Cost categories for construction jobs
    COST_CATEGORIES = {
      'materials' => {
        name: 'Materials',
        account_types: %w[expense],
        account_classes: %w[cost_of_sales direct_costs materials]
      },
      'labour' => {
        name: 'Labour',
        account_types: %w[expense],
        account_classes: %w[wages direct_costs labour]
      },
      'subcontractors' => {
        name: 'Subcontractors',
        account_types: %w[expense],
        account_classes: %w[cost_of_sales subcontractors contractors]
      },
      'equipment' => {
        name: 'Equipment',
        account_types: %w[expense],
        account_classes: %w[equipment plant_hire]
      },
      'overhead' => {
        name: 'Overhead',
        account_types: %w[expense],
        account_classes: %w[overhead indirect_costs admin]
      },
      'other' => {
        name: 'Other Costs',
        account_types: %w[expense],
        account_classes: []
      }
    }.freeze

    def initialize(job)
      @job = job
      @corporate_company = job.respond_to?(:corporate_company) ? job.corporate_company : CorporateCompany.first
    end

    # Get complete job costing summary
    #
    # @param as_at_date [Date] Calculate costs as at this date
    # @return [Hash] Complete job financial summary
    #
    def summary(as_at_date: Date.current)
      {
        job: job_info,
        period: { as_at: as_at_date },
        revenue: revenue_summary(as_at_date),
        costs: costs_summary(as_at_date),
        profit: profit_summary(as_at_date),
        budget_comparison: budget_comparison(as_at_date),
        cash_flow: cash_flow_summary(as_at_date),
        status: job_financial_status(as_at_date)
      }
    end

    # Get revenue for the job
    def revenue_summary(as_at_date = Date.current)
      # Revenue from invoices
      invoiced = Gl::Invoice
        .where(job: job)
        .where(invoice_type: 'sales_invoice')
        .where(status: %w[approved paid])
        .where('invoice_date <= ?', as_at_date)
        .sum(:total)

      # Paid amount
      paid = Gl::Invoice
        .where(job: job)
        .where(invoice_type: 'sales_invoice')
        .where(status: 'paid')
        .where('invoice_date <= ?', as_at_date)
        .sum(:total)

      # Contract value from job
      contract_value = job.contract_value || job.contract_price || 0

      # Variations (additional invoices beyond original contract)
      variations = [invoiced - contract_value, 0].max

      {
        contract_value: contract_value.to_d,
        variations: variations.to_d,
        total_revenue: invoiced.to_d,
        invoiced: invoiced.to_d,
        paid: paid.to_d,
        outstanding: (invoiced - paid).to_d,
        percent_invoiced: contract_value.positive? ? ((invoiced / contract_value) * 100).round(1) : 0
      }
    end

    # Get costs for the job by category
    def costs_summary(as_at_date = Date.current)
      # Get all cost ledger lines for this job
      cost_lines = Gl::LedgerLine
        .joins(:gl_journal_entry, :gl_account)
        .where(job: job)
        .where('gl_journal_entries.entry_date <= ?', as_at_date)
        .where(gl_accounts: { account_type: 'expense' })

      # Calculate by category
      by_category = {}
      total_costs = 0

      COST_CATEGORIES.each do |key, config|
        if config[:account_classes].any?
          category_lines = cost_lines.where(gl_accounts: { account_class: config[:account_classes] })
        else
          # 'other' catches everything not in a specific category
          used_classes = COST_CATEGORIES.values.flat_map { |c| c[:account_classes] }.compact
          category_lines = cost_lines.where.not(gl_accounts: { account_class: used_classes })
        end

        amount = category_lines.sum('debit - credit')
        by_category[key] = {
          name: config[:name],
          amount: amount.to_d,
          transaction_count: category_lines.count
        }
        total_costs += amount
      end

      # Also get from bills linked to job
      bills_total = Gl::Invoice
        .where(job: job)
        .where(invoice_type: 'bill')
        .where(status: %w[approved paid])
        .where('invoice_date <= ?', as_at_date)
        .sum(:total)

      {
        by_category: by_category,
        total_from_gl: total_costs.to_d,
        total_from_bills: bills_total.to_d,
        total: [total_costs, bills_total].max.to_d,
        paid: paid_costs(as_at_date),
        unpaid: unpaid_costs(as_at_date)
      }
    end

    # Calculate profit metrics
    def profit_summary(as_at_date = Date.current)
      revenue = revenue_summary(as_at_date)
      costs = costs_summary(as_at_date)

      gross_profit = revenue[:total_revenue] - costs[:total]
      margin = revenue[:total_revenue].positive? ?
        ((gross_profit / revenue[:total_revenue]) * 100).round(1) : 0

      # Budget comparison
      budget = job_budget
      budget_profit = budget[:revenue] - budget[:costs]
      budget_margin = budget[:revenue].positive? ?
        ((budget_profit / budget[:revenue]) * 100).round(1) : 0

      {
        gross_profit: gross_profit,
        gross_margin_percent: margin,
        budget_profit: budget_profit,
        budget_margin_percent: budget_margin,
        profit_variance: gross_profit - budget_profit,
        margin_variance: margin - budget_margin,
        on_track: gross_profit >= budget_profit
      }
    end

    # Budget vs Actual comparison
    def budget_comparison(as_at_date = Date.current)
      budget = job_budget
      actual_costs = costs_summary(as_at_date)
      actual_revenue = revenue_summary(as_at_date)

      # Percent complete based on costs incurred
      percent_complete = budget[:costs].positive? ?
        ((actual_costs[:total] / budget[:costs]) * 100).round(1) : 0

      # Cost variance (negative = over budget)
      cost_variance = budget[:costs] - actual_costs[:total]
      cost_variance_percent = budget[:costs].positive? ?
        ((cost_variance / budget[:costs]) * 100).round(1) : 0

      # Estimate at completion (EAC)
      # If we're X% complete and have spent Y, project final cost
      eac = percent_complete.positive? ?
        (actual_costs[:total] / (percent_complete / 100)).round(2) : budget[:costs]

      # Estimate to complete (ETC)
      etc = [eac - actual_costs[:total], 0].max

      {
        budget: {
          revenue: budget[:revenue],
          costs: budget[:costs],
          profit: budget[:revenue] - budget[:costs]
        },
        actual: {
          revenue: actual_revenue[:total_revenue],
          costs: actual_costs[:total],
          profit: actual_revenue[:total_revenue] - actual_costs[:total]
        },
        variance: {
          revenue: actual_revenue[:total_revenue] - budget[:revenue],
          costs: cost_variance,
          costs_percent: cost_variance_percent,
          profit: (actual_revenue[:total_revenue] - actual_costs[:total]) - (budget[:revenue] - budget[:costs])
        },
        progress: {
          percent_complete: percent_complete,
          estimate_at_completion: eac,
          estimate_to_complete: etc,
          variance_at_completion: budget[:costs] - eac
        }
      }
    end

    # Cash flow for the job
    def cash_flow_summary(as_at_date = Date.current)
      # Cash in (payments received)
      cash_in = Gl::Payment
        .joins(:gl_invoice)
        .where(gl_invoices: { job_id: job.id, invoice_type: 'sales_invoice' })
        .where('gl_payments.payment_date <= ?', as_at_date)
        .sum(:amount)

      # Cash out (bills paid)
      cash_out = Gl::Payment
        .joins(:gl_invoice)
        .where(gl_invoices: { job_id: job.id, invoice_type: 'bill' })
        .where('gl_payments.payment_date <= ?', as_at_date)
        .sum(:amount)

      {
        cash_in: cash_in.to_d,
        cash_out: cash_out.to_d,
        net_cash_flow: (cash_in - cash_out).to_d,
        cash_positive: cash_in >= cash_out
      }
    end

    # Get detailed cost breakdown by account
    def costs_by_account(as_at_date = Date.current)
      Gl::LedgerLine
        .joins(:gl_journal_entry, :gl_account)
        .where(job: job)
        .where('gl_journal_entries.entry_date <= ?', as_at_date)
        .where(gl_accounts: { account_type: 'expense' })
        .group('gl_accounts.id', 'gl_accounts.code', 'gl_accounts.name', 'gl_accounts.account_class')
        .select(
          'gl_accounts.id as account_id',
          'gl_accounts.code as account_code',
          'gl_accounts.name as account_name',
          'gl_accounts.account_class',
          'SUM(gl_ledger_lines.debit - gl_ledger_lines.credit) as amount',
          'COUNT(*) as transaction_count'
        )
        .order('amount DESC')
        .map do |row|
          {
            account_id: row.account_id,
            account_code: row.account_code,
            account_name: row.account_name,
            account_class: row.account_class,
            category: category_for_class(row.account_class),
            amount: row.amount.to_d,
            transaction_count: row.transaction_count
          }
        end
    end

    # Get transactions for the job
    def transactions(from_date: nil, to_date: Date.current, type: nil)
      lines = Gl::LedgerLine
        .joins(:gl_journal_entry, :gl_account)
        .includes(:gl_journal_entry, :gl_account, :contact)
        .where(job: job)

      lines = lines.where('gl_journal_entries.entry_date >= ?', from_date) if from_date
      lines = lines.where('gl_journal_entries.entry_date <= ?', to_date)

      case type
      when 'revenue'
        lines = lines.where(gl_accounts: { account_type: 'revenue' })
      when 'cost', 'expense'
        lines = lines.where(gl_accounts: { account_type: 'expense' })
      end

      lines.order('gl_journal_entries.entry_date DESC').map do |line|
        {
          id: line.id,
          date: line.gl_journal_entry.entry_date,
          description: line.description || line.gl_journal_entry.description,
          account: {
            id: line.gl_account.id,
            code: line.gl_account.code,
            name: line.gl_account.name
          },
          contact: line.contact&.name,
          debit: line.debit,
          credit: line.credit,
          amount: line.debit - line.credit,
          source: line.gl_journal_entry.source_type,
          source_number: line.gl_journal_entry.source_number
        }
      end
    end

    # Get WIP (Work in Progress) value
    def wip_value(as_at_date = Date.current)
      costs = costs_summary(as_at_date)
      revenue = revenue_summary(as_at_date)

      # WIP = Costs incurred - Revenue recognized (for incomplete jobs)
      # Simplified: costs that haven't been invoiced yet
      wip = [costs[:total] - revenue[:invoiced], 0].max

      {
        costs_incurred: costs[:total],
        revenue_recognized: revenue[:invoiced],
        wip_value: wip,
        has_wip: wip.positive?
      }
    end

    # Compare multiple jobs
    def self.compare_jobs(jobs, as_at_date: Date.current)
      jobs.map do |job|
        service = new(job)
        summary = service.summary(as_at_date: as_at_date)

        {
          job_id: job.id,
          job_name: job.name,
          contract_value: summary[:revenue][:contract_value],
          revenue: summary[:revenue][:total_revenue],
          costs: summary[:costs][:total],
          profit: summary[:profit][:gross_profit],
          margin: summary[:profit][:gross_margin_percent],
          percent_complete: summary[:budget_comparison][:progress][:percent_complete],
          on_track: summary[:profit][:on_track]
        }
      end
    end

    private

    def job_info
      {
        id: job.id,
        name: job.name,
        contract_value: job.contract_value || job.contract_price,
        status: job.job_status&.name,
        stage: job.job_stage&.name,
        start_date: job.start_date,
        practical_completion_date: job.practical_completion_date
      }
    end

    def job_budget
      # Get budget from GL budgets if available
      budgets = Gl::Budget.where(job: job)

      if budgets.any?
        {
          revenue: budgets.joins(:gl_account).where(gl_accounts: { account_type: 'revenue' }).sum(:amount),
          costs: budgets.joins(:gl_account).where(gl_accounts: { account_type: 'expense' }).sum(:amount)
        }
      else
        # Fall back to job contract value
        contract = job.contract_value || job.contract_price || 0
        # Estimate costs as contract minus expected margin (assume 15%)
        estimated_margin = 0.15
        {
          revenue: contract.to_d,
          costs: (contract * (1 - estimated_margin)).to_d
        }
      end
    end

    def paid_costs(as_at_date)
      Gl::Invoice
        .where(job: job)
        .where(invoice_type: 'bill')
        .where(status: 'paid')
        .where('invoice_date <= ?', as_at_date)
        .sum(:total).to_d
    end

    def unpaid_costs(as_at_date)
      Gl::Invoice
        .where(job: job)
        .where(invoice_type: 'bill')
        .where(status: 'approved')
        .where('invoice_date <= ?', as_at_date)
        .sum(:amount_due).to_d
    end

    def category_for_class(account_class)
      COST_CATEGORIES.each do |key, config|
        return key if config[:account_classes].include?(account_class)
      end
      'other'
    end

    def job_financial_status(as_at_date)
      profit = profit_summary(as_at_date)
      budget = budget_comparison(as_at_date)

      if profit[:gross_margin_percent] >= profit[:budget_margin_percent]
        { status: 'healthy', color: 'green', message: 'On or above target margin' }
      elsif profit[:gross_margin_percent] >= profit[:budget_margin_percent] - 5
        { status: 'warning', color: 'yellow', message: 'Slightly below target margin' }
      elsif profit[:gross_margin_percent] >= 0
        { status: 'at_risk', color: 'orange', message: 'Significantly below target' }
      else
        { status: 'critical', color: 'red', message: 'Job is loss-making' }
      end
    end
  end
end
