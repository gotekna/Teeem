# frozen_string_literal: true

module Gl
  module Reports
    # Job Profitability Report
    #
    # Generates comprehensive profitability analysis for jobs including:
    # - Individual job P&L
    # - Multi-job comparison
    # - Budget vs actual analysis
    # - Trend analysis
    # - Cost category breakdown
    #
    class JobProfitability
      attr_reader :corporate, :options

      def initialize(corporate, options = {})
        @corporate = corporate
        @options = options.with_indifferent_access
      end

      # Generate report for a single job
      def for_job(job, as_at_date: Date.current)
        service = Gl::JobCostingService.new(job)
        summary = service.summary(as_at_date: as_at_date)

        {
          report_type: 'single_job',
          generated_at: Time.current,
          as_at_date: as_at_date,
          job: summary[:job],
          profit_loss: build_job_pl(job, as_at_date),
          summary: summary,
          cost_breakdown: service.costs_by_account(as_at_date),
          transactions: options[:include_transactions] ? service.transactions(to_date: as_at_date) : nil,
          wip: service.wip_value(as_at_date)
        }
      end

      # Generate comparison report for multiple jobs
      def compare(jobs, as_at_date: Date.current)
        job_data = jobs.map do |job|
          service = Gl::JobCostingService.new(job)
          summary = service.summary(as_at_date: as_at_date)

          {
            job: summary[:job],
            revenue: summary[:revenue][:total_revenue],
            costs: summary[:costs][:total],
            profit: summary[:profit][:gross_profit],
            margin: summary[:profit][:gross_margin_percent],
            budget_variance: summary[:budget_comparison][:variance][:profit],
            percent_complete: summary[:budget_comparison][:progress][:percent_complete],
            status: summary[:status]
          }
        end

        # Sort by profit (highest first)
        job_data.sort_by! { |j| -j[:profit] }

        # Calculate totals
        totals = {
          revenue: job_data.sum { |j| j[:revenue] },
          costs: job_data.sum { |j| j[:costs] },
          profit: job_data.sum { |j| j[:profit] },
          jobs_count: job_data.length,
          profitable_count: job_data.count { |j| j[:profit].positive? },
          at_risk_count: job_data.count { |j| j[:status][:status].in?(%w[at_risk critical]) }
        }

        totals[:margin] = totals[:revenue].positive? ?
          ((totals[:profit] / totals[:revenue]) * 100).round(1) : 0

        {
          report_type: 'comparison',
          generated_at: Time.current,
          as_at_date: as_at_date,
          jobs: job_data,
          totals: totals,
          rankings: build_rankings(job_data)
        }
      end

      # Generate summary report for all active jobs
      def all_jobs_summary(as_at_date: Date.current)
        jobs = find_active_jobs
        compare(jobs, as_at_date: as_at_date)
      end

      # Generate monthly profitability trend for a job
      def monthly_trend(job, months: 12)
        end_date = Date.current.end_of_month
        start_date = (end_date - months.months).beginning_of_month

        monthly_data = []
        current = start_date

        while current <= end_date
          month_end = current.end_of_month
          service = Gl::JobCostingService.new(job)

          # Get cumulative values as at month end
          summary = service.summary(as_at_date: month_end)

          monthly_data << {
            month: current.strftime('%b %Y'),
            month_date: current,
            revenue: summary[:revenue][:total_revenue],
            costs: summary[:costs][:total],
            profit: summary[:profit][:gross_profit],
            margin: summary[:profit][:gross_margin_percent],
            percent_complete: summary[:budget_comparison][:progress][:percent_complete]
          }

          current = current.next_month
        end

        # Calculate month-over-month changes
        monthly_data.each_with_index do |data, index|
          if index > 0
            prev = monthly_data[index - 1]
            data[:revenue_change] = data[:revenue] - prev[:revenue]
            data[:costs_change] = data[:costs] - prev[:costs]
            data[:profit_change] = data[:profit] - prev[:profit]
          else
            data[:revenue_change] = 0
            data[:costs_change] = 0
            data[:profit_change] = 0
          end
        end

        {
          report_type: 'monthly_trend',
          generated_at: Time.current,
          job: { id: job.id, name: job.name },
          period: { start: start_date, end: end_date, months: months },
          data: monthly_data
        }
      end

      # Generate cost category analysis across jobs
      def cost_category_analysis(jobs = nil, as_at_date: Date.current)
        jobs ||= find_active_jobs

        # Aggregate costs by category across all jobs
        category_totals = Hash.new { |h, k| h[k] = { amount: 0, jobs_count: 0 } }

        jobs.each do |job|
          service = Gl::JobCostingService.new(job)
          costs = service.costs_summary(as_at_date)

          costs[:by_category].each do |category, data|
            category_totals[category][:amount] += data[:amount]
            category_totals[category][:jobs_count] += 1 if data[:amount].positive?
            category_totals[category][:name] = data[:name]
          end
        end

        # Calculate percentages
        total_costs = category_totals.values.sum { |c| c[:amount] }
        category_totals.each do |_key, data|
          data[:percentage] = total_costs.positive? ?
            ((data[:amount] / total_costs) * 100).round(1) : 0
        end

        {
          report_type: 'cost_category_analysis',
          generated_at: Time.current,
          as_at_date: as_at_date,
          jobs_analyzed: jobs.length,
          total_costs: total_costs,
          categories: category_totals.sort_by { |_k, v| -v[:amount] }.to_h
        }
      end

      # Budget variance report
      def budget_variance_report(jobs = nil, as_at_date: Date.current)
        jobs ||= find_active_jobs

        variance_data = jobs.map do |job|
          service = Gl::JobCostingService.new(job)
          comparison = service.budget_comparison(as_at_date)

          {
            job: { id: job.id, name: job.name },
            budget_costs: comparison[:budget][:costs],
            actual_costs: comparison[:actual][:costs],
            cost_variance: comparison[:variance][:costs],
            cost_variance_percent: comparison[:variance][:costs_percent],
            budget_profit: comparison[:budget][:profit],
            actual_profit: comparison[:actual][:profit],
            profit_variance: comparison[:variance][:profit],
            percent_complete: comparison[:progress][:percent_complete],
            estimate_at_completion: comparison[:progress][:estimate_at_completion],
            over_budget: comparison[:variance][:costs].negative?
          }
        end

        # Sort by variance (worst first)
        variance_data.sort_by! { |v| v[:cost_variance] }

        over_budget_jobs = variance_data.select { |v| v[:over_budget] }

        {
          report_type: 'budget_variance',
          generated_at: Time.current,
          as_at_date: as_at_date,
          jobs: variance_data,
          summary: {
            total_jobs: variance_data.length,
            over_budget_count: over_budget_jobs.length,
            total_over_budget_amount: over_budget_jobs.sum { |v| v[:cost_variance].abs },
            under_budget_count: variance_data.length - over_budget_jobs.length
          }
        }
      end

      # WIP (Work in Progress) report
      def wip_report(as_at_date: Date.current)
        jobs = find_active_jobs

        wip_data = jobs.map do |job|
          service = Gl::JobCostingService.new(job)
          wip = service.wip_value(as_at_date)

          next unless wip[:has_wip]

          {
            job: { id: job.id, name: job.name },
            costs_incurred: wip[:costs_incurred],
            revenue_recognized: wip[:revenue_recognized],
            wip_value: wip[:wip_value]
          }
        end.compact

        total_wip = wip_data.sum { |w| w[:wip_value] }

        {
          report_type: 'wip',
          generated_at: Time.current,
          as_at_date: as_at_date,
          jobs_with_wip: wip_data.length,
          total_wip: total_wip,
          data: wip_data.sort_by { |w| -w[:wip_value] }
        }
      end

      private

      def build_job_pl(job, as_at_date)
        # Get revenue lines
        revenue_lines = Gl::LedgerLine
          .joins(:gl_journal_entry, :gl_account)
          .where(job: job)
          .where('gl_journal_entries.entry_date <= ?', as_at_date)
          .where(gl_accounts: { account_type: 'revenue' })
          .group('gl_accounts.id', 'gl_accounts.code', 'gl_accounts.name')
          .select(
            'gl_accounts.code',
            'gl_accounts.name',
            'SUM(gl_ledger_lines.credit - gl_ledger_lines.debit) as amount'
          )
          .order('amount DESC')

        # Get expense lines
        expense_lines = Gl::LedgerLine
          .joins(:gl_journal_entry, :gl_account)
          .where(job: job)
          .where('gl_journal_entries.entry_date <= ?', as_at_date)
          .where(gl_accounts: { account_type: 'expense' })
          .group('gl_accounts.id', 'gl_accounts.code', 'gl_accounts.name')
          .select(
            'gl_accounts.code',
            'gl_accounts.name',
            'SUM(gl_ledger_lines.debit - gl_ledger_lines.credit) as amount'
          )
          .order('amount DESC')

        total_revenue = revenue_lines.sum(&:amount)
        total_expenses = expense_lines.sum(&:amount)

        {
          revenue: {
            lines: revenue_lines.map { |l| { code: l.code, name: l.name, amount: l.amount.to_d } },
            total: total_revenue.to_d
          },
          expenses: {
            lines: expense_lines.map { |l| { code: l.code, name: l.name, amount: l.amount.to_d } },
            total: total_expenses.to_d
          },
          gross_profit: (total_revenue - total_expenses).to_d,
          gross_margin: total_revenue.positive? ?
            (((total_revenue - total_expenses) / total_revenue) * 100).round(1) : 0
        }
      end

      def build_rankings(job_data)
        {
          by_profit: job_data.first(5).map { |j| { id: j[:job][:id], name: j[:job][:name], value: j[:profit] } },
          by_margin: job_data.sort_by { |j| -j[:margin] }.first(5).map { |j|
            { id: j[:job][:id], name: j[:job][:name], value: j[:margin] }
          },
          by_revenue: job_data.sort_by { |j| -j[:revenue] }.first(5).map { |j|
            { id: j[:job][:id], name: j[:job][:name], value: j[:revenue] }
          },
          worst_performers: job_data.last(5).reverse.map { |j|
            { id: j[:job][:id], name: j[:job][:name], value: j[:profit] }
          }
        }
      end

      def find_active_jobs
        # Find jobs that are active (not archived, not completed)
        Job.where(archived_at: nil)
          .joins(:job_status)
          .where.not(job_statuses: { name: %w[Completed Cancelled Archived] })
          .order(:name)
      end
    end
  end
end
