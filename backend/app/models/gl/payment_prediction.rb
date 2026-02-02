# frozen_string_literal: true

module Gl
  # Late payment prediction for invoices
  class PaymentPrediction < ApplicationRecord
    self.table_name = "gl_payment_predictions"

    RISK_LEVELS = %w[low medium high].freeze

    belongs_to :corporate_company, class_name: "Corporate"
    belongs_to :invoice, class_name: "Gl::Invoice"
    belongs_to :contact, optional: true

    validates :probability_late, presence: true, numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 1 }
    validates :risk_level, inclusion: { in: RISK_LEVELS }, allow_blank: true

    scope :high_risk, -> { where(risk_level: "high") }
    scope :for_invoice, ->(invoice) { where(invoice: invoice) }
    scope :recent, -> { order(created_at: :desc) }

    before_save :set_risk_level

    # Generate prediction for an invoice
    def self.predict!(invoice)
      return nil unless invoice.unpaid?

      company = invoice.corporate_company
      contact = invoice.contact

      # Get customer stats
      stats = Gl::CustomerPaymentStats.find_or_initialize_by(
        corporate_company: company,
        contact: contact
      )

      # Calculate probability based on various factors
      probability = calculate_probability(invoice, stats)
      predicted_days = calculate_predicted_days_late(invoice, stats)

      create!(
        corporate_company: company,
        invoice: invoice,
        contact: contact,
        probability_late: probability,
        predicted_days_late: predicted_days,
        predicted_payment_date: invoice.due_date + predicted_days.days,
        risk_factors: extract_risk_factors(invoice, stats)
      )
    end

    # Update prediction with actual outcome
    def record_outcome!(payment_date)
      was_late = payment_date > invoice.due_date
      days_late = was_late ? (payment_date - invoice.due_date).to_i : 0

      update!(
        prediction_correct: (probability_late >= 0.5) == was_late,
        actual_payment_date: payment_date
      )

      # Update customer stats
      Gl::CustomerPaymentStats.record_payment!(
        corporate_company: corporate_company,
        contact: contact,
        invoice: invoice,
        payment_date: payment_date
      )
    end

    # Prediction accuracy
    def self.accuracy(company, period: 30.days)
      predictions = where(corporate_company: company)
                    .where.not(prediction_correct: nil)
                    .where("created_at >= ?", period.ago)

      return 0 if predictions.empty?

      correct = predictions.where(prediction_correct: true).count
      (correct.to_f / predictions.count * 100).round(1)
    end

    private

    def set_risk_level
      self.risk_level = if probability_late >= 0.7
                          "high"
                        elsif probability_late >= 0.4
                          "medium"
                        else
                          "low"
                        end
    end

    def self.calculate_probability(invoice, stats)
      probability = 0.1 # Base probability

      # Customer history factor (biggest weight)
      if stats.total_invoices > 0
        late_ratio = stats.paid_late.to_f / stats.total_invoices
        probability += late_ratio * 0.4
      else
        # New customer - higher uncertainty
        probability += 0.15
      end

      # Invoice amount factor
      if stats.largest_invoice && invoice.total > stats.largest_invoice
        probability += 0.1 # Larger than usual invoice
      end

      # Days until due factor
      days_until_due = (invoice.due_date - Date.current).to_i
      if days_until_due < 7
        probability += 0.05 # Close to due date
      elsif days_until_due < 0
        probability += 0.3 # Already overdue
      end

      # Outstanding balance factor
      if stats.total_outstanding > 0
        outstanding_ratio = stats.total_outstanding / (stats.total_invoiced + 0.01)
        probability += outstanding_ratio * 0.2
      end

      # Payment reliability score factor
      if stats.payment_reliability_score
        reliability_penalty = (100 - stats.payment_reliability_score) / 100.0 * 0.2
        probability += reliability_penalty
      end

      [probability, 1.0].min
    end

    def self.calculate_predicted_days_late(invoice, stats)
      return 0 if stats.average_days_late.nil? || stats.average_days_late <= 0

      # Base on historical average
      base_days = stats.average_days_late.ceil

      # Adjust for invoice size
      if stats.largest_invoice && invoice.total > stats.largest_invoice * 0.8
        base_days = (base_days * 1.2).ceil
      end

      [base_days, 90].min # Cap at 90 days
    end

    def self.extract_risk_factors(invoice, stats)
      factors = []

      # Customer history
      if stats.total_invoices.zero?
        factors << { factor: "new_customer", description: "New customer with no payment history" }
      elsif stats.paid_late > stats.paid_on_time
        factors << { factor: "late_payer", description: "Customer frequently pays late" }
      end

      # Outstanding balance
      if stats.total_outstanding > 0
        factors << {
          factor: "outstanding_balance",
          description: "Customer has outstanding balance of #{stats.total_outstanding}"
        }
      end

      # Large invoice
      if stats.largest_invoice && invoice.total > stats.largest_invoice
        factors << { factor: "large_invoice", description: "Largest invoice for this customer" }
      end

      # Overdue
      if invoice.due_date < Date.current
        days_overdue = (Date.current - invoice.due_date).to_i
        factors << { factor: "overdue", description: "Already #{days_overdue} days overdue" }
      end

      factors
    end
  end
end
