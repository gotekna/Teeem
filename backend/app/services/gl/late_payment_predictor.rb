# frozen_string_literal: true

module Gl
  # Predicts which invoices are likely to be paid late
  # Uses historical payment patterns per contact to score risk
  #
  # SSoT: This is THE service for late payment prediction
  # Works across all invoice systems (GL, External, Subcontractor)
  #
  class LatePaymentPredictor
    include AnthropicClient

    # Risk thresholds
    HIGH_RISK_THRESHOLD = 70
    MEDIUM_RISK_THRESHOLD = 40

    # Minimum history for reliable predictions
    MIN_INVOICE_HISTORY = 3

    def initialize(corporate_company)
      @company = corporate_company
    end

    # Get risk assessment for a single invoice
    def predict_for_invoice(invoice)
      contact = invoice.contact
      return nil_prediction("No contact linked") unless contact

      history = contact_payment_history(contact)
      return nil_prediction("Insufficient history") if history[:total_invoices] < MIN_INVOICE_HISTORY

      calculate_invoice_risk(invoice, history)
    end

    # Get all at-risk invoices sorted by risk score
    def at_risk_invoices(limit: 50, min_risk: MEDIUM_RISK_THRESHOLD)
      unpaid_invoices.filter_map do |invoice|
        prediction = predict_for_invoice(invoice)
        next unless prediction && prediction[:risk_score] >= min_risk

        prediction.merge(invoice: invoice_json(invoice))
      end.sort_by { |p| -p[:risk_score] }.first(limit)
    end

    # Get summary statistics
    def summary_stats
      invoices = unpaid_invoices
      predictions = invoices.filter_map { |inv| predict_for_invoice(inv) }

      {
        total_unpaid: invoices.count,
        with_predictions: predictions.count,
        high_risk: predictions.count { |p| p[:risk_score] >= HIGH_RISK_THRESHOLD },
        medium_risk: predictions.count { |p| p[:risk_score] >= MEDIUM_RISK_THRESHOLD && p[:risk_score] < HIGH_RISK_THRESHOLD },
        low_risk: predictions.count { |p| p[:risk_score] < MEDIUM_RISK_THRESHOLD },
        total_at_risk_amount: predictions
          .select { |p| p[:risk_score] >= MEDIUM_RISK_THRESHOLD }
          .sum { |p| p[:amount_at_risk] || 0 }
      }
    end

    # Get payment behavior for all contacts (for dashboards)
    def contact_payment_behaviors(limit: 100)
      contacts_with_history
        .map { |c| contact_behavior_summary(c) }
        .sort_by { |b| -b[:average_days_late] }
        .first(limit)
    end

    # Calculate and cache contact payment history
    def contact_payment_history(contact)
      # Get all paid invoices for this contact
      paid_gl = Gl::Invoice
        .where(contact: contact, invoice_type: "sales_invoice", status: "paid")
        .where.not(approved_at: nil)
        .pluck(:due_date, :approved_at, :invoice_date, :total)

      paid_external = ExternalInvoice
        .where(contact: contact, invoice_type: "invoice", status: "paid")
        .where.not(fully_paid_date: nil)
        .pluck(:due_date, :fully_paid_date, :invoice_date, :total)

      # Calculate payment behavior metrics
      all_payments = []

      paid_gl.each do |due_date, approved_at, invoice_date, total|
        next unless due_date && approved_at
        days_to_pay = (approved_at.to_date - invoice_date.to_date).to_i rescue nil
        days_late = (approved_at.to_date - due_date).to_i rescue nil
        next unless days_to_pay && days_late

        all_payments << {
          days_to_pay: days_to_pay,
          days_late: days_late,
          was_late: days_late > 0,
          total: total
        }
      end

      paid_external.each do |due_date, fully_paid_date, invoice_date, total|
        next unless due_date && fully_paid_date
        days_to_pay = (fully_paid_date - invoice_date).to_i rescue nil
        days_late = (fully_paid_date - due_date).to_i rescue nil
        next unless days_to_pay && days_late

        all_payments << {
          days_to_pay: days_to_pay,
          days_late: days_late,
          was_late: days_late > 0,
          total: total
        }
      end

      return empty_history if all_payments.empty?

      # Calculate statistics
      {
        total_invoices: all_payments.count,
        late_invoices: all_payments.count { |p| p[:was_late] },
        late_rate: (all_payments.count { |p| p[:was_late] }.to_f / all_payments.count * 100).round(1),
        average_days_to_pay: (all_payments.sum { |p| p[:days_to_pay] }.to_f / all_payments.count).round(1),
        average_days_late: (all_payments.select { |p| p[:was_late] }.sum { |p| p[:days_late] }.to_f / [all_payments.count { |p| p[:was_late] }, 1].max).round(1),
        max_days_late: all_payments.select { |p| p[:was_late] }.map { |p| p[:days_late] }.max || 0,
        total_amount: all_payments.sum { |p| p[:total].to_d },
        recent_trend: calculate_trend(all_payments.last(5))
      }
    end

    private

    def calculate_invoice_risk(invoice, history)
      risk_score = 0
      factors = []

      # Factor 1: Historical late payment rate (0-40 points)
      if history[:late_rate] >= 80
        risk_score += 40
        factors << "Very high historical late payment rate (#{history[:late_rate]}%)"
      elsif history[:late_rate] >= 50
        risk_score += 30
        factors << "High historical late payment rate (#{history[:late_rate]}%)"
      elsif history[:late_rate] >= 25
        risk_score += 15
        factors << "Moderate historical late payment rate (#{history[:late_rate]}%)"
      end

      # Factor 2: Average days late (0-25 points)
      if history[:average_days_late] >= 30
        risk_score += 25
        factors << "Typically pays #{history[:average_days_late].round} days late"
      elsif history[:average_days_late] >= 14
        risk_score += 15
        factors << "Typically pays #{history[:average_days_late].round} days late"
      elsif history[:average_days_late] >= 7
        risk_score += 8
        factors << "Occasionally pays late"
      end

      # Factor 3: Recent trend (0-15 points)
      case history[:recent_trend]
      when "worsening"
        risk_score += 15
        factors << "Payment behavior worsening recently"
      when "stable_late"
        risk_score += 8
        factors << "Consistently late payments"
      when "improving"
        risk_score -= 10
        factors << "Payment behavior improving"
      end

      # Factor 4: Invoice already overdue (0-20 points)
      if invoice.respond_to?(:overdue?) && invoice.overdue?
        days_overdue = (Date.current - invoice.due_date).to_i rescue 0
        if days_overdue >= 30
          risk_score += 20
          factors << "Already #{days_overdue} days overdue"
        elsif days_overdue >= 7
          risk_score += 12
          factors << "Already #{days_overdue} days overdue"
        else
          risk_score += 5
          factors << "Just became overdue"
        end
      elsif invoice.due_date && invoice.due_date < Date.current
        days_overdue = (Date.current - invoice.due_date).to_i
        if days_overdue > 0
          risk_score += [days_overdue, 20].min
          factors << "Invoice is #{days_overdue} days overdue"
        end
      end

      # Factor 5: Large invoice amount (0-10 points)
      invoice_amount = invoice.try(:total) || invoice.try(:amount) || 0
      avg_amount = history[:total_amount].to_f / [history[:total_invoices], 1].max

      if invoice_amount > avg_amount * 2
        risk_score += 10
        factors << "Invoice amount significantly higher than usual"
      elsif invoice_amount > avg_amount * 1.5
        risk_score += 5
        factors << "Invoice amount above average"
      end

      # Cap risk score at 100
      risk_score = [[risk_score, 0].max, 100].min

      {
        risk_score: risk_score,
        risk_level: risk_level(risk_score),
        predicted_days_late: predict_days_late(history, risk_score),
        amount_at_risk: invoice_amount,
        factors: factors,
        contact_history: {
          total_invoices: history[:total_invoices],
          late_rate: history[:late_rate],
          average_days_late: history[:average_days_late]
        }
      }
    end

    def risk_level(score)
      if score >= HIGH_RISK_THRESHOLD
        "high"
      elsif score >= MEDIUM_RISK_THRESHOLD
        "medium"
      else
        "low"
      end
    end

    def predict_days_late(history, risk_score)
      return 0 if risk_score < MEDIUM_RISK_THRESHOLD

      # Use historical average as baseline, adjust by risk
      base_days = history[:average_days_late]

      case risk_score
      when 70..100
        [base_days * 1.5, base_days + 14].max.round
      when 40..70
        [base_days * 1.2, base_days + 7].max.round
      else
        base_days.round
      end
    end

    def calculate_trend(recent_payments)
      return "unknown" if recent_payments.length < 3

      # Compare first half to second half
      mid = recent_payments.length / 2
      first_half = recent_payments[0...mid]
      second_half = recent_payments[mid..]

      first_avg = first_half.sum { |p| p[:days_late] }.to_f / first_half.length
      second_avg = second_half.sum { |p| p[:days_late] }.to_f / second_half.length

      if second_avg > first_avg + 5
        "worsening"
      elsif second_avg < first_avg - 5
        "improving"
      elsif first_avg > 3 && second_avg > 3
        "stable_late"
      else
        "stable_good"
      end
    end

    def unpaid_invoices
      gl_unpaid = Gl::Invoice
        .where(corporate_company: @company, invoice_type: "sales_invoice")
        .where.not(status: %w[paid voided deleted draft])
        .includes(:contact)

      external_unpaid = ExternalInvoice
        .where(corporate_company: @company, invoice_type: "invoice")
        .where.not(status: %w[paid voided deleted draft])
        .includes(:contact)

      gl_unpaid.to_a + external_unpaid.to_a
    end

    def contacts_with_history
      # Get contacts that have paid invoices (for behavior analysis)
      contact_ids = Gl::Invoice
        .where(corporate_company: @company, invoice_type: "sales_invoice", status: "paid")
        .distinct
        .pluck(:contact_id)

      contact_ids += ExternalInvoice
        .where(corporate_company: @company, invoice_type: "invoice", status: "paid")
        .distinct
        .pluck(:contact_id)

      Contact.where(id: contact_ids.uniq.compact)
    end

    def contact_behavior_summary(contact)
      history = contact_payment_history(contact)

      {
        contact_id: contact.id,
        contact_name: contact.display_name,
        total_invoices: history[:total_invoices],
        late_invoices: history[:late_invoices],
        late_rate: history[:late_rate],
        average_days_to_pay: history[:average_days_to_pay],
        average_days_late: history[:average_days_late],
        max_days_late: history[:max_days_late],
        recent_trend: history[:recent_trend],
        total_amount: history[:total_amount],
        risk_level: calculate_contact_risk_level(history)
      }
    end

    def calculate_contact_risk_level(history)
      return "unknown" if history[:total_invoices] < MIN_INVOICE_HISTORY

      if history[:late_rate] >= 60 || history[:average_days_late] >= 21
        "high"
      elsif history[:late_rate] >= 30 || history[:average_days_late] >= 10
        "medium"
      else
        "low"
      end
    end

    def empty_history
      {
        total_invoices: 0,
        late_invoices: 0,
        late_rate: 0.0,
        average_days_to_pay: 0.0,
        average_days_late: 0.0,
        max_days_late: 0,
        total_amount: 0,
        recent_trend: "unknown"
      }
    end

    def nil_prediction(reason)
      {
        risk_score: nil,
        risk_level: "unknown",
        predicted_days_late: nil,
        amount_at_risk: nil,
        factors: [reason],
        contact_history: nil
      }
    end

    def invoice_json(invoice)
      {
        id: invoice.id,
        type: invoice.class.name,
        invoice_number: invoice.try(:invoice_number) || invoice.try(:reference),
        contact_id: invoice.contact_id,
        contact_name: invoice.contact&.display_name || invoice.try(:contact_name),
        total: invoice.try(:total) || invoice.try(:amount),
        due_date: invoice.due_date,
        invoice_date: invoice.invoice_date,
        status: invoice.status,
        days_overdue: invoice.due_date ? [(Date.current - invoice.due_date).to_i, 0].max : 0
      }
    end
  end
end
