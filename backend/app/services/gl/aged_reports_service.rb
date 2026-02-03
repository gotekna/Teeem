# frozen_string_literal: true

module Gl
  # Aged Reports Service
  # Generates aged receivables and payables reports
  class AgedReportsService
    attr_reader :company, :as_at_date

    AGING_BUCKETS = [
      { key: :current, label: 'Current', min: 0, max: 0 },
      { key: :days_1_30, label: '1-30 Days', min: 1, max: 30 },
      { key: :days_31_60, label: '31-60 Days', min: 31, max: 60 },
      { key: :days_61_90, label: '61-90 Days', min: 61, max: 90 },
      { key: :days_90_plus, label: '90+ Days', min: 91, max: Float::INFINITY }
    ].freeze

    def initialize(company, as_at_date: nil)
      @company = company
      @as_at_date = as_at_date || Date.current
    end

    # =========================================================================
    # RECEIVABLES
    # =========================================================================

    def receivables
      {
        as_at_date: as_at_date,
        summary: receivables_summary,
        aging: receivables_aging,
        by_customer: receivables_by_customer,
        overdue: overdue_receivables
      }
    end

    def receivables_summary
      total = total_receivables
      overdue = overdue_receivables_total

      {
        total: total,
        current: total - overdue,
        overdue: overdue,
        overdue_percent: total.zero? ? 0 : (overdue / total * 100).round(1),
        average_days: calculate_average_days(:receivables),
        count: receivables_count
      }
    end

    def receivables_aging
      AGING_BUCKETS.map do |bucket|
        amount = calculate_bucket_amount(:receivables, bucket[:min], bucket[:max])
        {
          bucket: bucket[:key],
          label: bucket[:label],
          amount: amount,
          count: calculate_bucket_count(:receivables, bucket[:min], bucket[:max]),
          percent: total_receivables.zero? ? 0 : (amount / total_receivables * 100).round(1)
        }
      end
    end

    def receivables_by_customer
      # Group by contact and calculate aging
      ar_entries.group_by(&:contact_id).map do |contact_id, lines|
        contact = Contact.find_by(id: contact_id)
        total = lines.sum { |l| l.debit - l.credit }
        overdue = lines.select { |l| days_outstanding(l) > 0 }.sum { |l| l.debit - l.credit }

        {
          contact_id: contact_id,
          contact_name: contact&.name || 'Unknown',
          total: total,
          current: total - overdue,
          overdue: overdue,
          oldest_invoice_days: lines.map { |l| days_outstanding(l) }.max || 0,
          aging: customer_aging(lines)
        }
      end.sort_by { |c| -c[:total] }
    end

    def receivables_for_customer(contact_id)
      lines = ar_entries.where(contact_id: contact_id)
      contact = Contact.find_by(id: contact_id)

      {
        contact_id: contact_id,
        contact_name: contact&.name || 'Unknown',
        as_at_date: as_at_date,
        invoices: lines.map { |l| invoice_detail(l) },
        summary: {
          total: lines.sum { |l| l.debit - l.credit },
          count: lines.count,
          aging: customer_aging(lines)
        }
      }
    end

    def receivables_follow_up
      # Prioritized list for follow-up
      overdue = ar_entries.select { |l| days_outstanding(l) > 0 }

      overdue.map do |line|
        {
          contact_id: line.contact_id,
          contact_name: line.contact&.name || 'Unknown',
          invoice_number: line.reference,
          amount: line.debit - line.credit,
          days_overdue: days_outstanding(line),
          priority: follow_up_priority(line),
          suggested_action: suggested_action(line)
        }
      end.sort_by { |i| [-i[:priority], -i[:days_overdue]] }
    end

    # =========================================================================
    # PAYABLES
    # =========================================================================

    def payables
      {
        as_at_date: as_at_date,
        summary: payables_summary,
        aging: payables_aging,
        by_supplier: payables_by_supplier,
        due_soon: payables_due_soon
      }
    end

    def payables_summary
      total = total_payables
      overdue = overdue_payables_total

      {
        total: total,
        current: total - overdue,
        overdue: overdue,
        overdue_percent: total.zero? ? 0 : (overdue / total * 100).round(1),
        average_days: calculate_average_days(:payables),
        count: payables_count
      }
    end

    def payables_aging
      AGING_BUCKETS.map do |bucket|
        amount = calculate_bucket_amount(:payables, bucket[:min], bucket[:max])
        {
          bucket: bucket[:key],
          label: bucket[:label],
          amount: amount,
          count: calculate_bucket_count(:payables, bucket[:min], bucket[:max]),
          percent: total_payables.zero? ? 0 : (amount / total_payables * 100).round(1)
        }
      end
    end

    def payables_by_supplier
      ap_entries.group_by(&:contact_id).map do |contact_id, lines|
        contact = Contact.find_by(id: contact_id)
        total = lines.sum { |l| l.credit - l.debit }.abs
        overdue = lines.select { |l| days_outstanding(l) > 0 }.sum { |l| l.credit - l.debit }.abs

        {
          contact_id: contact_id,
          contact_name: contact&.name || 'Unknown',
          total: total,
          current: total - overdue,
          overdue: overdue,
          oldest_bill_days: lines.map { |l| days_outstanding(l) }.max || 0,
          aging: supplier_aging(lines)
        }
      end.sort_by { |s| -s[:total] }
    end

    def payables_for_supplier(contact_id)
      lines = ap_entries.where(contact_id: contact_id)
      contact = Contact.find_by(id: contact_id)

      {
        contact_id: contact_id,
        contact_name: contact&.name || 'Unknown',
        as_at_date: as_at_date,
        bills: lines.map { |l| bill_detail(l) },
        summary: {
          total: lines.sum { |l| l.credit - l.debit }.abs,
          count: lines.count,
          aging: supplier_aging(lines)
        }
      }
    end

    def payables_due_within(days)
      due_date = as_at_date + days.days
      ap_entries.select { |l| bill_due_date(l) <= due_date }.map do |line|
        {
          contact_id: line.contact_id,
          contact_name: line.contact&.name || 'Unknown',
          bill_number: line.reference,
          amount: (line.credit - line.debit).abs,
          due_date: bill_due_date(line),
          days_until_due: (bill_due_date(line) - as_at_date).to_i
        }
      end.sort_by { |b| b[:due_date] }
    end

    def payables_payment_schedule
      # Group by week for payment planning
      weeks = (0..12).map { |i| as_at_date + (i * 7).days }

      weeks.each_cons(2).map do |week_start, week_end|
        bills = ap_entries.select do |l|
          due = bill_due_date(l)
          due >= week_start && due < week_end
        end

        {
          week_start: week_start,
          week_end: week_end - 1.day,
          total: bills.sum { |l| (l.credit - l.debit).abs },
          count: bills.count,
          bills: bills.map { |l| { supplier: l.contact&.name, amount: (l.credit - l.debit).abs } }
        }
      end
    end

    # =========================================================================
    # COMBINED / DASHBOARD
    # =========================================================================

    def dashboard
      {
        as_at_date: as_at_date,
        receivables: receivables_summary,
        payables: payables_summary,
        net_position: total_receivables - total_payables,
        comparison: {
          receivables_vs_payables: comparison_chart_data,
          aging_comparison: aging_comparison_data
        }
      }
    end

    def comparison
      {
        as_at_date: as_at_date,
        receivables: {
          total: total_receivables,
          aging: receivables_aging
        },
        payables: {
          total: total_payables,
          aging: payables_aging
        },
        net_by_bucket: AGING_BUCKETS.map do |bucket|
          ar = calculate_bucket_amount(:receivables, bucket[:min], bucket[:max])
          ap = calculate_bucket_amount(:payables, bucket[:min], bucket[:max])
          {
            bucket: bucket[:key],
            label: bucket[:label],
            receivables: ar,
            payables: ap,
            net: ar - ap
          }
        end
      }
    end

    def critical
      {
        severely_overdue_receivables: ar_entries.select { |l| days_outstanding(l) > 90 }.map do |l|
          { contact: l.contact&.name, amount: l.debit - l.credit, days: days_outstanding(l) }
        end,
        high_value_overdue: ar_entries.select { |l| days_outstanding(l) > 30 && (l.debit - l.credit) > 10_000 }.map do |l|
          { contact: l.contact&.name, amount: l.debit - l.credit, days: days_outstanding(l) }
        end,
        overdue_payables: ap_entries.select { |l| days_outstanding(l) > 0 }.map do |l|
          { supplier: l.contact&.name, amount: (l.credit - l.debit).abs, days: days_outstanding(l) }
        end
      }
    end

    def chart_data
      {
        receivables_aging: receivables_aging.map { |b| { label: b[:label], value: b[:amount] } },
        payables_aging: payables_aging.map { |b| { label: b[:label], value: b[:amount] } },
        top_debtors: receivables_by_customer.first(10).map { |c| { name: c[:contact_name], amount: c[:total] } },
        top_creditors: payables_by_supplier.first(10).map { |s| { name: s[:contact_name], amount: s[:total] } }
      }
    end

    private

    # Get AR account entries
    def ar_entries
      @ar_entries ||= begin
        ar_account = Gl::Account.find_by(
          corporate: company,
          system_account: 'accounts_receivable'
        )
        return [] unless ar_account

        Gl::LedgerLine.joins(:gl_journal_entry)
                      .where(gl_account: ar_account)
                      .where('gl_journal_entries.entry_date <= ?', as_at_date)
                      .includes(:contact, :gl_journal_entry)
      end
    end

    # Get AP account entries
    def ap_entries
      @ap_entries ||= begin
        ap_account = Gl::Account.find_by(
          corporate: company,
          system_account: 'accounts_payable'
        )
        return [] unless ap_account

        Gl::LedgerLine.joins(:gl_journal_entry)
                      .where(gl_account: ap_account)
                      .where('gl_journal_entries.entry_date <= ?', as_at_date)
                      .includes(:contact, :gl_journal_entry)
      end
    end

    def total_receivables
      @total_receivables ||= ar_entries.sum { |l| l.debit - l.credit }
    end

    def total_payables
      @total_payables ||= ap_entries.sum { |l| l.credit - l.debit }.abs
    end

    def overdue_receivables_total
      ar_entries.select { |l| days_outstanding(l) > 0 }.sum { |l| l.debit - l.credit }
    end

    def overdue_payables_total
      ap_entries.select { |l| days_outstanding(l) > 0 }.sum { |l| l.credit - l.debit }.abs
    end

    def receivables_count
      ar_entries.count
    end

    def payables_count
      ap_entries.count
    end

    def payables_due_soon
      payables_due_within(7)
    end

    def days_outstanding(line)
      entry_date = line.gl_journal_entry.entry_date
      (as_at_date - entry_date).to_i
    end

    def bill_due_date(line)
      # Assume 30 day terms if not specified
      line.gl_journal_entry.entry_date + 30.days
    end

    def calculate_bucket_amount(type, min_days, max_days)
      entries = type == :receivables ? ar_entries : ap_entries

      entries.select do |l|
        days = days_outstanding(l)
        days >= min_days && days <= max_days
      end.sum do |l|
        type == :receivables ? (l.debit - l.credit) : (l.credit - l.debit).abs
      end
    end

    def calculate_bucket_count(type, min_days, max_days)
      entries = type == :receivables ? ar_entries : ap_entries

      entries.count do |l|
        days = days_outstanding(l)
        days >= min_days && days <= max_days
      end
    end

    def calculate_average_days(type)
      entries = type == :receivables ? ar_entries : ap_entries
      return 0 if entries.empty?

      total_days = entries.sum { |l| days_outstanding(l) }
      (total_days.to_f / entries.count).round(1)
    end

    def customer_aging(lines)
      AGING_BUCKETS.map do |bucket|
        amount = lines.select { |l| days_outstanding(l).between?(bucket[:min], bucket[:max] == Float::INFINITY ? 9999 : bucket[:max]) }
                      .sum { |l| l.debit - l.credit }
        { bucket: bucket[:key], amount: amount }
      end
    end

    def supplier_aging(lines)
      AGING_BUCKETS.map do |bucket|
        amount = lines.select { |l| days_outstanding(l).between?(bucket[:min], bucket[:max] == Float::INFINITY ? 9999 : bucket[:max]) }
                      .sum { |l| l.credit - l.debit }.abs
        { bucket: bucket[:key], amount: amount }
      end
    end

    def invoice_detail(line)
      {
        date: line.gl_journal_entry.entry_date,
        invoice_number: line.reference,
        description: line.description,
        amount: line.debit - line.credit,
        days_outstanding: days_outstanding(line)
      }
    end

    def bill_detail(line)
      {
        date: line.gl_journal_entry.entry_date,
        bill_number: line.reference,
        description: line.description,
        amount: (line.credit - line.debit).abs,
        due_date: bill_due_date(line),
        days_outstanding: days_outstanding(line)
      }
    end

    def follow_up_priority(line)
      days = days_outstanding(line)
      amount = line.debit - line.credit

      # Higher priority for older and larger amounts
      age_score = [days / 30, 4].min  # 0-4 based on age
      amount_score = case amount
                     when 0..1000 then 1
                     when 1001..5000 then 2
                     when 5001..10000 then 3
                     else 4
                     end

      age_score + amount_score
    end

    def suggested_action(line)
      days = days_outstanding(line)

      case days
      when 1..30 then 'Send friendly reminder'
      when 31..60 then 'Phone call follow-up'
      when 61..90 then 'Send formal demand letter'
      else 'Consider debt collection'
      end
    end

    def comparison_chart_data
      [
        { label: 'Receivables', value: total_receivables },
        { label: 'Payables', value: total_payables }
      ]
    end

    def aging_comparison_data
      AGING_BUCKETS.map do |bucket|
        {
          label: bucket[:label],
          receivables: calculate_bucket_amount(:receivables, bucket[:min], bucket[:max]),
          payables: calculate_bucket_amount(:payables, bucket[:min], bucket[:max])
        }
      end
    end
  end
end
