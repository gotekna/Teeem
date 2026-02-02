# frozen_string_literal: true

module Gl
  # Aggregated payment statistics per customer
  class CustomerPaymentStats < ApplicationRecord
    self.table_name = "gl_customer_payment_stats"

    belongs_to :corporate, foreign_key: "company_id"
    belongs_to :contact

    scope :good_payers, -> { where("payment_reliability_score >= 80") }
    scope :risky_payers, -> { where("payment_reliability_score < 50") }
    scope :with_outstanding, -> { where("total_outstanding > 0") }

    # Record a payment
    def self.record_payment!(corporate:, contact:, invoice:, payment_date:)
      stats = find_or_initialize_by(corporate: corporate, contact: contact)

      was_late = payment_date > invoice.due_date
      days_to_pay = (payment_date - invoice.date).to_i
      days_late = was_late ? (payment_date - invoice.due_date).to_i : 0

      stats.total_invoices += 1
      if was_late
        stats.paid_late += 1
        stats.last_late_payment = payment_date
        stats.average_days_late = recalc_average(stats.average_days_late, days_late, stats.paid_late)
      else
        stats.paid_on_time += 1
      end

      stats.average_days_to_pay = recalc_average(stats.average_days_to_pay, days_to_pay, stats.total_invoices)
      stats.total_invoiced += invoice.total
      stats.last_payment_date = payment_date
      stats.largest_invoice = [stats.largest_invoice || 0, invoice.total].max

      # Recalculate outstanding
      stats.total_outstanding = corporate.gl_invoices
                                                 .where(contact: contact, status: %w[authorised sent])
                                                 .sum(:amount_due)

      # Update reliability score
      stats.calculate_reliability_score!

      stats.save!
      stats
    end

    # Recalculate from scratch
    def recalculate!
      invoices = corporate.gl_invoices.where(contact: contact)
      payments = Gl::Payment.where(corporate: corporate)
                            .joins(:allocations)
                            .where(gl_payment_allocations: { invoice_id: invoices.select(:id) })

      self.total_invoices = invoices.where(status: "paid").count
      self.paid_on_time = 0
      self.paid_late = 0
      total_days_to_pay = 0
      total_days_late = 0

      invoices.where(status: "paid").find_each do |inv|
        payment = payments.where(gl_payment_allocations: { invoice_id: inv.id }).order(:date).first
        next unless payment

        days_to_pay = (payment.date - inv.date).to_i
        total_days_to_pay += days_to_pay

        if payment.date > inv.due_date
          self.paid_late += 1
          days_late = (payment.date - inv.due_date).to_i
          total_days_late += days_late
          self.last_late_payment = [last_late_payment, payment.date].compact.max
        else
          self.paid_on_time += 1
        end

        self.last_payment_date = [last_payment_date, payment.date].compact.max
      end

      self.average_days_to_pay = total_invoices.positive? ? total_days_to_pay.to_f / total_invoices : nil
      self.average_days_late = paid_late.positive? ? total_days_late.to_f / paid_late : nil

      self.total_invoiced = invoices.sum(:total)
      self.total_outstanding = invoices.where(status: %w[authorised sent]).sum(:amount_due)
      self.largest_invoice = invoices.maximum(:total)

      calculate_reliability_score!
      save!
    end

    # Calculate reliability score (0-100)
    def calculate_reliability_score!
      return self.payment_reliability_score = 50 if total_invoices.zero?

      score = 100.0

      # On-time ratio (50% of score)
      on_time_ratio = paid_on_time.to_f / total_invoices
      score *= (0.5 + on_time_ratio * 0.5)

      # Average days late penalty (up to 20% penalty)
      if average_days_late && average_days_late > 0
        late_penalty = [average_days_late / 30.0 * 20, 20].min
        score -= late_penalty
      end

      # Outstanding balance penalty (up to 15% penalty)
      if total_outstanding > 0 && total_invoiced > 0
        outstanding_ratio = total_outstanding / total_invoiced
        score -= outstanding_ratio * 15
      end

      # Recency bonus (10% boost if paid recently)
      if last_payment_date && last_payment_date > 30.days.ago
        score += 10
      end

      self.payment_reliability_score = [[score, 0].max, 100].min
    end

    # Customers at risk of late payment
    def self.at_risk(company, threshold: 50)
      where(corporate: company)
        .where("payment_reliability_score < ?", threshold)
        .order(:payment_reliability_score)
    end

    # Best customers
    def self.best_payers(company, limit: 10)
      where(corporate: company)
        .where("total_invoices >= 3")
        .order(payment_reliability_score: :desc)
        .limit(limit)
    end

    private

    def self.recalc_average(current_avg, new_value, new_count)
      return new_value.to_f if new_count <= 1 || current_avg.nil?
      ((current_avg * (new_count - 1)) + new_value) / new_count.to_f
    end
  end
end
