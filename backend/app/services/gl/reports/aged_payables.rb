# frozen_string_literal: true

module Gl
  module Reports
    # Aged Payables Report
    #
    # Provides detailed analysis of outstanding supplier bills including:
    # - Aging buckets (Current, 30, 60, 90, 120+ days)
    # - Supplier summaries
    # - Payment scheduling recommendations
    # - Cash flow impact analysis
    #
    class AgedPayables
      attr_reader :corporate_company, :as_at_date, :options

      # Aging bucket definitions (same as AR for consistency)
      AGING_BUCKETS = [
        { key: :current, label: 'Current', min: nil, max: 0 },
        { key: :days_1_30, label: '1-30 Days', min: 1, max: 30 },
        { key: :days_31_60, label: '31-60 Days', min: 31, max: 60 },
        { key: :days_61_90, label: '61-90 Days', min: 61, max: 90 },
        { key: :days_91_120, label: '91-120 Days', min: 91, max: 120 },
        { key: :days_120_plus, label: '120+ Days', min: 121, max: nil }
      ].freeze

      def initialize(corporate_company, options = {})
        @corporate_company = corporate_company
        @as_at_date = options[:as_at_date] || Date.current
        @options = options.with_indifferent_access
      end

      # Generate full aged payables report
      def generate
        bills = outstanding_bills
        by_supplier = group_by_supplier(bills)

        {
          report_type: 'aged_payables',
          generated_at: Time.current,
          as_at_date: as_at_date,
          summary: build_summary(bills),
          aging_buckets: build_aging_summary(bills),
          by_supplier: by_supplier,
          critical_suppliers: critical_suppliers(by_supplier),
          payment_schedule: generate_payment_schedule(bills),
          cash_flow_impact: calculate_cash_flow_impact(bills)
        }
      end

      # Get summary only
      def summary
        bills = outstanding_bills
        build_summary(bills)
      end

      # Get aging by bucket
      def aging_summary
        bills = outstanding_bills
        build_aging_summary(bills)
      end

      # Get supplier breakdown
      def by_supplier
        bills = outstanding_bills
        group_by_supplier(bills)
      end

      # Get bills for a specific supplier
      def for_supplier(contact_id)
        bills = outstanding_bills.where(contact_id: contact_id)

        supplier = Contact.find_by(id: contact_id)
        return nil unless supplier

        {
          supplier: {
            id: supplier.id,
            name: supplier.name,
            email: supplier.email,
            phone: supplier.phone
          },
          bills: bills.map { |bill| bill_detail(bill) },
          summary: {
            total_outstanding: bills.sum(&:amount_due),
            bill_count: bills.count,
            oldest_bill_date: bills.minimum(:invoice_date),
            average_days_overdue: calculate_average_days_overdue(bills)
          },
          aging: calculate_supplier_aging(bills),
          payment_terms: supplier_payment_terms(supplier),
          spend_analysis: supplier_spend_analysis(supplier)
        }
      end

      # Get bills due in next X days
      def due_within(days)
        cutoff_date = as_at_date + days.days

        bills = outstanding_bills.where('due_date <= ?', cutoff_date)

        bills.map do |bill|
          {
            bill: bill_detail(bill),
            days_until_due: (bill.due_date - as_at_date).to_i,
            priority: payment_priority(bill)
          }
        end.sort_by { |b| b[:days_until_due] }
      end

      # Generate optimal payment schedule
      def payment_schedule(available_cash: nil)
        bills = outstanding_bills.order(:due_date)

        schedule = {
          week_1: { bills: [], total: 0 },
          week_2: { bills: [], total: 0 },
          week_3: { bills: [], total: 0 },
          week_4: { bills: [], total: 0 },
          beyond: { bills: [], total: 0 }
        }

        bills.each do |bill|
          days_until_due = (bill.due_date - as_at_date).to_i
          priority = payment_priority(bill)

          bill_info = {
            id: bill.id,
            number: bill.invoice_number,
            supplier: bill.contact&.name,
            amount: bill.amount_due,
            due_date: bill.due_date,
            priority: priority
          }

          week_key = case days_until_due
          when -Float::INFINITY..0 then :week_1  # Overdue
          when 1..7 then :week_1
          when 8..14 then :week_2
          when 15..21 then :week_3
          when 22..28 then :week_4
          else :beyond
          end

          schedule[week_key][:bills] << bill_info
          schedule[week_key][:total] += bill.amount_due
        end

        # Sort each week by priority
        schedule.each do |_week, data|
          data[:bills].sort_by! { |b| priority_order(b[:priority]) }
        end

        # Add cash availability check if provided
        if available_cash
          running_cash = available_cash
          schedule.each do |week, data|
            data[:cash_available] = running_cash
            data[:can_pay_all] = running_cash >= data[:total]
            data[:shortfall] = [data[:total] - running_cash, 0].max
            running_cash -= data[:total]
          end
        end

        schedule
      end

      private

      def outstanding_bills
        @bills ||= Gl::Invoice
          .where(corporate_company: corporate_company)
          .where(invoice_type: 'bill')
          .where(status: %w[approved submitted])
          .where('amount_due > 0')
          .includes(:contact, :job)
          .order(:due_date)
      end

      def build_summary(bills)
        total = bills.sum(&:amount_due)
        overdue = bills.select { |b| b.due_date < as_at_date }
        overdue_total = overdue.sum(&:amount_due)

        # Due this week
        due_this_week = bills.select { |b| b.due_date.between?(as_at_date, as_at_date + 7.days) }

        {
          total_outstanding: total.to_d,
          total_bills: bills.count,
          total_overdue: overdue_total.to_d,
          overdue_count: overdue.count,
          overdue_percentage: total.positive? ? ((overdue_total / total) * 100).round(1) : 0,
          due_this_week: due_this_week.sum(&:amount_due).to_d,
          due_this_week_count: due_this_week.count,
          unique_suppliers: bills.map(&:contact_id).uniq.compact.count,
          oldest_bill: bills.min_by(&:invoice_date)&.invoice_date,
          dpo: calculate_dpo # Days Payable Outstanding
        }
      end

      def build_aging_summary(bills)
        buckets = {}

        AGING_BUCKETS.each do |bucket|
          bucket_bills = bills.select { |bill| in_bucket?(bill, bucket) }

          buckets[bucket[:key]] = {
            label: bucket[:label],
            amount: bucket_bills.sum(&:amount_due).to_d,
            count: bucket_bills.count,
            bills: options[:include_bills] ? bucket_bills.map { |b| bill_summary(b) } : nil
          }
        end

        buckets[:total] = {
          amount: bills.sum(&:amount_due).to_d,
          count: bills.count
        }

        buckets
      end

      def group_by_supplier(bills)
        grouped = bills.group_by(&:contact_id)

        grouped.map do |contact_id, supplier_bills|
          contact = supplier_bills.first.contact

          aging = {}
          AGING_BUCKETS.each do |bucket|
            bucket_bills = supplier_bills.select { |bill| in_bucket?(bill, bucket) }
            aging[bucket[:key]] = bucket_bills.sum(&:amount_due).to_d
          end

          {
            supplier_id: contact_id,
            supplier_name: contact&.name || 'Unknown',
            supplier_email: contact&.email,
            total_outstanding: supplier_bills.sum(&:amount_due).to_d,
            bill_count: supplier_bills.count,
            aging: aging,
            oldest_bill: supplier_bills.min_by(&:invoice_date)&.invoice_date,
            next_due: supplier_bills.min_by(&:due_date)&.due_date,
            is_critical: supplier_bills.any? { |b| payment_priority(b) == 'critical' },
            bills: options[:include_bills] ? supplier_bills.map { |b| bill_summary(b) } : nil
          }
        end.sort_by { |s| -s[:total_outstanding] }
      end

      def critical_suppliers(by_supplier)
        by_supplier
          .select { |s| s[:is_critical] }
          .sort_by { |s| s[:next_due] || Date.current + 1000.years }
          .first(10)
      end

      def generate_payment_schedule(bills)
        schedule = []

        # Group by week
        (0..12).each do |week_offset|
          week_start = as_at_date + (week_offset * 7).days
          week_end = week_start + 6.days

          week_bills = bills.select do |bill|
            if week_offset == 0
              # First week includes overdue
              bill.due_date <= week_end
            else
              bill.due_date.between?(week_start, week_end)
            end
          end

          next if week_bills.empty?

          schedule << {
            week: week_offset + 1,
            week_start: week_start,
            week_end: week_end,
            label: week_offset == 0 ? 'This Week (incl. overdue)' : "Week #{week_offset + 1}",
            total_due: week_bills.sum(&:amount_due).to_d,
            bill_count: week_bills.count,
            critical_total: week_bills.select { |b| payment_priority(b) == 'critical' }.sum(&:amount_due).to_d
          }
        end

        schedule
      end

      def calculate_cash_flow_impact(bills)
        # Impact by week
        impact = {}
        running_total = 0

        (0..12).each do |week_offset|
          week_start = as_at_date + (week_offset * 7).days
          week_end = week_start + 6.days

          week_amount = bills.select do |bill|
            if week_offset == 0
              bill.due_date <= week_end
            else
              bill.due_date.between?(week_start, week_end)
            end
          end.sum(&:amount_due)

          running_total += week_amount

          impact["week_#{week_offset + 1}"] = {
            amount: week_amount.to_d,
            cumulative: running_total.to_d
          }
        end

        {
          by_week: impact,
          total_90_days: running_total.to_d
        }
      end

      def in_bucket?(bill, bucket)
        days = (as_at_date - bill.due_date).to_i # Positive = overdue

        min_match = bucket[:min].nil? || days >= bucket[:min]
        max_match = bucket[:max].nil? || days <= bucket[:max]

        min_match && max_match
      end

      def calculate_average_days_overdue(bills)
        overdue = bills.select { |b| b.due_date < as_at_date }
        return 0 if overdue.empty?

        total_days = overdue.sum { |b| (as_at_date - b.due_date).to_i }
        (total_days.to_f / overdue.count).round(1)
      end

      def calculate_supplier_aging(bills)
        aging = {}
        AGING_BUCKETS.each do |bucket|
          bucket_bills = bills.select { |bill| in_bucket?(bill, bucket) }
          aging[bucket[:key]] = bucket_bills.sum(&:amount_due).to_d
        end
        aging
      end

      def calculate_dpo
        # Days Payable Outstanding = (AP / Total Purchases) * Days
        bills = outstanding_bills
        return 0 if bills.empty?

        total_ap = bills.sum(&:amount_due)

        # Get total purchases for last 90 days
        purchases_90_days = Gl::Invoice
          .where(corporate_company: corporate_company)
          .where(invoice_type: 'bill')
          .where('invoice_date >= ?', as_at_date - 90.days)
          .where('invoice_date <= ?', as_at_date)
          .sum(:total)

        return 0 if purchases_90_days.zero?

        daily_purchases = purchases_90_days / 90.0
        (total_ap / daily_purchases).round(0)
      end

      def payment_priority(bill)
        days_overdue = (as_at_date - bill.due_date).to_i

        if days_overdue > 60
          'critical'  # Very overdue - relationship at risk
        elsif days_overdue > 30
          'high'      # Significantly overdue
        elsif days_overdue > 0
          'medium'    # Overdue
        elsif (bill.due_date - as_at_date).to_i <= 7
          'medium'    # Due soon
        else
          'low'       # Not urgent
        end
      end

      def priority_order(priority)
        case priority
        when 'critical' then 0
        when 'high' then 1
        when 'medium' then 2
        else 3
        end
      end

      def supplier_payment_terms(supplier)
        # Would analyze payment term patterns
        { average_days: 30, typical_terms: 'Net 30' }
      end

      def supplier_spend_analysis(supplier)
        # Last 12 months of bills from this supplier
        bills = Gl::Invoice
          .where(corporate_company: corporate_company)
          .where(contact: supplier)
          .where(invoice_type: 'bill')
          .where('invoice_date >= ?', 12.months.ago)

        {
          total_12_months: bills.sum(:total),
          bill_count: bills.count,
          average_bill: bills.count.positive? ? (bills.sum(:total) / bills.count).round(2) : 0
        }
      end

      def bill_detail(bill)
        {
          id: bill.id,
          bill_number: bill.invoice_number,
          supplier: bill.contact&.name,
          supplier_id: bill.contact_id,
          invoice_date: bill.invoice_date,
          due_date: bill.due_date,
          total: bill.total,
          amount_due: bill.amount_due,
          amount_paid: bill.total - bill.amount_due,
          days_overdue: [(as_at_date - bill.due_date).to_i, 0].max,
          priority: payment_priority(bill),
          job: bill.job&.name,
          job_id: bill.job_id
        }
      end

      def bill_summary(bill)
        {
          id: bill.id,
          number: bill.invoice_number,
          date: bill.invoice_date,
          due_date: bill.due_date,
          amount_due: bill.amount_due,
          priority: payment_priority(bill)
        }
      end
    end
  end
end
