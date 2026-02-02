# frozen_string_literal: true

module Gl
  module Reports
    # Aged Receivables Report
    #
    # Provides detailed analysis of outstanding customer invoices including:
    # - Aging buckets (Current, 30, 60, 90, 120+ days)
    # - Customer summaries
    # - Follow-up recommendations
    # - Collection risk scoring
    # - Payment history analysis
    #
    class AgedReceivables
      attr_reader :corporate, :as_at_date, :options

      # Aging bucket definitions
      AGING_BUCKETS = [
        { key: :current, label: 'Current', min: nil, max: 0 },
        { key: :days_1_30, label: '1-30 Days', min: 1, max: 30 },
        { key: :days_31_60, label: '31-60 Days', min: 31, max: 60 },
        { key: :days_61_90, label: '61-90 Days', min: 61, max: 90 },
        { key: :days_91_120, label: '91-120 Days', min: 91, max: 120 },
        { key: :days_120_plus, label: '120+ Days', min: 121, max: nil }
      ].freeze

      # Risk scoring weights
      RISK_WEIGHTS = {
        current: 0,
        days_1_30: 10,
        days_31_60: 25,
        days_61_90: 50,
        days_91_120: 75,
        days_120_plus: 100
      }.freeze

      def initialize(corporate, options = {})
        @corporate = corporate
        @as_at_date = options[:as_at_date] || Date.current
        @options = options.with_indifferent_access
      end

      # Generate full aged receivables report
      def generate
        invoices = outstanding_invoices
        by_customer = group_by_customer(invoices)

        {
          report_type: 'aged_receivables',
          generated_at: Time.current,
          as_at_date: as_at_date,
          summary: build_summary(invoices),
          aging_buckets: build_aging_summary(invoices),
          by_customer: by_customer,
          high_risk_customers: high_risk_customers(by_customer),
          follow_up_actions: generate_follow_up_actions(invoices),
          collection_forecast: collection_forecast(invoices)
        }
      end

      # Get summary only
      def summary
        invoices = outstanding_invoices
        build_summary(invoices)
      end

      # Get aging by bucket
      def aging_summary
        invoices = outstanding_invoices
        build_aging_summary(invoices)
      end

      # Get customer breakdown
      def by_customer
        invoices = outstanding_invoices
        group_by_customer(invoices)
      end

      # Get invoices for a specific customer
      def for_customer(contact_id)
        invoices = outstanding_invoices.where(contact_id: contact_id)

        customer = Contact.find_by(id: contact_id)
        return nil unless customer

        {
          customer: {
            id: customer.id,
            name: customer.name,
            email: customer.email,
            phone: customer.phone
          },
          invoices: invoices.map { |inv| invoice_detail(inv) },
          summary: {
            total_outstanding: invoices.sum(&:amount_due),
            invoice_count: invoices.count,
            oldest_invoice_date: invoices.minimum(:invoice_date),
            average_days_overdue: calculate_average_days_overdue(invoices)
          },
          aging: calculate_customer_aging(invoices),
          payment_history: customer_payment_history(customer),
          risk_score: calculate_customer_risk_score(invoices)
        }
      end

      # Get invoices requiring follow-up
      def follow_up_required
        invoices = outstanding_invoices.select { |inv| needs_follow_up?(inv) }

        invoices.map do |invoice|
          {
            invoice: invoice_detail(invoice),
            reason: follow_up_reason(invoice),
            priority: follow_up_priority(invoice),
            suggested_action: suggested_action(invoice),
            last_contact: last_contact_date(invoice)
          }
        end.sort_by { |f| -f[:priority] }
      end

      private

      def outstanding_invoices
        @invoices ||= Gl::Invoice
          .where(corporate: corporate)
          .where(invoice_type: 'sales_invoice')
          .where(status: %w[approved submitted])
          .where('amount_due > 0')
          .includes(:contact, :job)
          .order(:due_date)
      end

      def build_summary(invoices)
        total = invoices.sum(&:amount_due)
        overdue = invoices.select(&:overdue?)
        overdue_total = overdue.sum(&:amount_due)

        {
          total_outstanding: total.to_d,
          total_invoices: invoices.count,
          total_overdue: overdue_total.to_d,
          overdue_count: overdue.count,
          overdue_percentage: total.positive? ? ((overdue_total / total) * 100).round(1) : 0,
          average_days_outstanding: calculate_average_days_overdue(invoices),
          unique_customers: invoices.map(&:contact_id).uniq.compact.count,
          oldest_invoice: invoices.min_by(&:invoice_date)&.invoice_date,
          dso: calculate_dso # Days Sales Outstanding
        }
      end

      def build_aging_summary(invoices)
        buckets = {}

        AGING_BUCKETS.each do |bucket|
          bucket_invoices = invoices.select { |inv| in_bucket?(inv, bucket) }

          buckets[bucket[:key]] = {
            label: bucket[:label],
            amount: bucket_invoices.sum(&:amount_due).to_d,
            count: bucket_invoices.count,
            invoices: options[:include_invoices] ? bucket_invoices.map { |i| invoice_summary(i) } : nil
          }
        end

        buckets[:total] = {
          amount: invoices.sum(&:amount_due).to_d,
          count: invoices.count
        }

        buckets
      end

      def group_by_customer(invoices)
        grouped = invoices.group_by(&:contact_id)

        grouped.map do |contact_id, customer_invoices|
          contact = customer_invoices.first.contact

          aging = {}
          AGING_BUCKETS.each do |bucket|
            bucket_invoices = customer_invoices.select { |inv| in_bucket?(inv, bucket) }
            aging[bucket[:key]] = bucket_invoices.sum(&:amount_due).to_d
          end

          {
            customer_id: contact_id,
            customer_name: contact&.name || 'Unknown',
            customer_email: contact&.email,
            total_outstanding: customer_invoices.sum(&:amount_due).to_d,
            invoice_count: customer_invoices.count,
            aging: aging,
            oldest_invoice: customer_invoices.min_by(&:invoice_date)&.invoice_date,
            risk_score: calculate_customer_risk_score(customer_invoices),
            invoices: options[:include_invoices] ? customer_invoices.map { |i| invoice_summary(i) } : nil
          }
        end.sort_by { |c| -c[:total_outstanding] }
      end

      def high_risk_customers(by_customer)
        by_customer
          .select { |c| c[:risk_score] >= 50 }
          .sort_by { |c| -c[:risk_score] }
          .first(10)
      end

      def generate_follow_up_actions(invoices)
        actions = []

        # Group overdue invoices by priority
        overdue = invoices.select(&:overdue?)

        # Critical: 90+ days
        critical = overdue.select { |inv| inv.days_overdue >= 90 }
        if critical.any?
          actions << {
            priority: 'critical',
            action: 'escalate_to_collections',
            description: "#{critical.count} invoices are 90+ days overdue totaling #{format_currency(critical.sum(&:amount_due))}",
            invoices: critical.map { |i| { id: i.id, number: i.invoice_number, amount: i.amount_due } }
          }
        end

        # High: 60-89 days
        high = overdue.select { |inv| inv.days_overdue.between?(60, 89) }
        if high.any?
          actions << {
            priority: 'high',
            action: 'final_notice',
            description: "Send final payment notice to #{high.count} customers (60-90 days overdue)",
            invoices: high.map { |i| { id: i.id, number: i.invoice_number, amount: i.amount_due } }
          }
        end

        # Medium: 30-59 days
        medium = overdue.select { |inv| inv.days_overdue.between?(30, 59) }
        if medium.any?
          actions << {
            priority: 'medium',
            action: 'reminder_call',
            description: "Follow up call for #{medium.count} invoices (30-60 days overdue)",
            invoices: medium.map { |i| { id: i.id, number: i.invoice_number, amount: i.amount_due } }
          }
        end

        # Low: 1-29 days
        low = overdue.select { |inv| inv.days_overdue.between?(1, 29) }
        if low.any?
          actions << {
            priority: 'low',
            action: 'reminder_email',
            description: "Send payment reminder to #{low.count} customers",
            invoices: low.map { |i| { id: i.id, number: i.invoice_number, amount: i.amount_due } }
          }
        end

        actions
      end

      def collection_forecast(invoices)
        # Estimate when invoices will be collected based on aging
        forecast = {
          next_7_days: 0,
          next_30_days: 0,
          next_60_days: 0,
          uncertain: 0
        }

        invoices.each do |invoice|
          probability = collection_probability(invoice)

          if invoice.days_overdue <= 0
            # Current - expect payment by due date or shortly after
            if invoice.due_date <= as_at_date + 7.days
              forecast[:next_7_days] += invoice.amount_due * probability
            elsif invoice.due_date <= as_at_date + 30.days
              forecast[:next_30_days] += invoice.amount_due * probability
            else
              forecast[:next_60_days] += invoice.amount_due * probability
            end
          elsif invoice.days_overdue <= 30
            forecast[:next_30_days] += invoice.amount_due * probability
          elsif invoice.days_overdue <= 60
            forecast[:next_60_days] += invoice.amount_due * probability
          else
            forecast[:uncertain] += invoice.amount_due * probability
          end
        end

        forecast.transform_values { |v| v.round(2) }
      end

      def in_bucket?(invoice, bucket)
        days = invoice.days_overdue

        min_match = bucket[:min].nil? || days >= bucket[:min]
        max_match = bucket[:max].nil? || days <= bucket[:max]

        min_match && max_match
      end

      def calculate_average_days_overdue(invoices)
        return 0 if invoices.empty?

        total_days = invoices.sum { |inv| [inv.days_overdue, 0].max }
        (total_days.to_f / invoices.count).round(1)
      end

      def calculate_customer_aging(invoices)
        aging = {}
        AGING_BUCKETS.each do |bucket|
          bucket_invoices = invoices.select { |inv| in_bucket?(inv, bucket) }
          aging[bucket[:key]] = bucket_invoices.sum(&:amount_due).to_d
        end
        aging
      end

      def calculate_customer_risk_score(invoices)
        return 0 if invoices.empty?

        # Weighted average based on aging
        total_weighted = 0
        total_amount = 0

        invoices.each do |invoice|
          bucket = AGING_BUCKETS.find { |b| in_bucket?(invoice, b) }
          weight = RISK_WEIGHTS[bucket[:key]] || 0
          total_weighted += invoice.amount_due * weight
          total_amount += invoice.amount_due
        end

        return 0 if total_amount.zero?

        (total_weighted / total_amount).round(0)
      end

      def calculate_dso
        # Days Sales Outstanding = (AR / Total Credit Sales) * Days
        # Simplified: average collection period
        invoices = outstanding_invoices
        return 0 if invoices.empty?

        total_ar = invoices.sum(&:amount_due)

        # Get total sales for last 90 days
        sales_90_days = Gl::Invoice
          .where(corporate: corporate)
          .where(invoice_type: 'sales_invoice')
          .where('invoice_date >= ?', as_at_date - 90.days)
          .where('invoice_date <= ?', as_at_date)
          .sum(:total)

        return 0 if sales_90_days.zero?

        daily_sales = sales_90_days / 90.0
        (total_ar / daily_sales).round(0)
      end

      def collection_probability(invoice)
        case invoice.days_overdue
        when -Float::INFINITY..0 then 0.95
        when 1..30 then 0.85
        when 31..60 then 0.70
        when 61..90 then 0.50
        when 91..120 then 0.30
        else 0.15
        end
      end

      def customer_payment_history(customer)
        # Get last 12 months of paid invoices
        paid_invoices = Gl::Invoice
          .where(corporate: corporate)
          .where(contact: customer)
          .where(invoice_type: 'sales_invoice')
          .where(status: 'paid')
          .where('invoice_date >= ?', 12.months.ago)
          .order(invoice_date: :desc)

        {
          invoices_paid: paid_invoices.count,
          total_paid: paid_invoices.sum(:total),
          average_payment_time: calculate_average_payment_time(paid_invoices),
          on_time_percentage: calculate_on_time_percentage(paid_invoices)
        }
      end

      def calculate_average_payment_time(paid_invoices)
        return nil if paid_invoices.empty?

        # Would need payment date tracking
        # Simplified for now
        nil
      end

      def calculate_on_time_percentage(paid_invoices)
        # Would need payment date vs due date comparison
        nil
      end

      def invoice_detail(invoice)
        {
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          customer: invoice.contact&.name,
          customer_id: invoice.contact_id,
          invoice_date: invoice.invoice_date,
          due_date: invoice.due_date,
          total: invoice.total,
          amount_due: invoice.amount_due,
          amount_paid: invoice.total - invoice.amount_due,
          days_overdue: invoice.days_overdue,
          job: invoice.job&.name,
          job_id: invoice.job_id
        }
      end

      def invoice_summary(invoice)
        {
          id: invoice.id,
          number: invoice.invoice_number,
          date: invoice.invoice_date,
          due_date: invoice.due_date,
          amount_due: invoice.amount_due,
          days_overdue: invoice.days_overdue
        }
      end

      def needs_follow_up?(invoice)
        invoice.overdue? && invoice.days_overdue >= 7
      end

      def follow_up_reason(invoice)
        if invoice.days_overdue >= 90
          'Severely overdue - escalation required'
        elsif invoice.days_overdue >= 60
          'Significantly overdue - final notice needed'
        elsif invoice.days_overdue >= 30
          'Overdue - follow-up call recommended'
        else
          'Recently overdue - reminder needed'
        end
      end

      def follow_up_priority(invoice)
        case invoice.days_overdue
        when 90.. then 100
        when 60..89 then 75
        when 30..59 then 50
        else 25
        end
      end

      def suggested_action(invoice)
        case invoice.days_overdue
        when 90..
          'Escalate to collections or consider legal action'
        when 60..89
          'Send final demand letter with payment deadline'
        when 30..59
          'Phone call to accounts payable department'
        when 14..29
          'Send reminder email with payment details'
        else
          'Send friendly payment reminder'
        end
      end

      def last_contact_date(invoice)
        # Would track follow-up history
        nil
      end

      def format_currency(amount)
        "$#{amount.to_i.to_s.reverse.gsub(/(\d{3})(?=\d)/, '\\1,').reverse}"
      end
    end
  end
end
