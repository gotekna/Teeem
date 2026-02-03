# frozen_string_literal: true

module Gl
  # Detected anomalies in financial data
  class Anomaly < ApplicationRecord
    self.table_name = "gl_anomalies"

    ANOMALY_TYPES = %w[unusual_amount timing duplicate pattern_break missing_data unauthorized].freeze
    SEVERITIES = %w[low medium high critical].freeze
    STATUSES = %w[open investigating resolved dismissed].freeze

    belongs_to :corporate, foreign_key: "company_id"
    belongs_to :anomalable, polymorphic: true, optional: true
    belongs_to :assigned_to, class_name: "User", optional: true
    belongs_to :resolved_by, class_name: "User", optional: true

    validates :anomaly_type, presence: true, inclusion: { in: ANOMALY_TYPES }
    validates :severity, presence: true, inclusion: { in: SEVERITIES }
    validates :description, presence: true
    validates :status, inclusion: { in: STATUSES }

    scope :open, -> { where(status: "open") }
    scope :critical, -> { where(severity: "critical") }
    scope :high_priority, -> { where(severity: %w[high critical]) }
    scope :recent, -> { order(created_at: :desc) }
    scope :for_type, ->(type) { where(anomaly_type: type) }
    scope :unresolved, -> { where(status: %w[open investigating]) }

    # Assign to user
    def assign!(user)
      update!(assigned_to: user, status: "investigating")
    end

    # Resolve anomaly
    def resolve!(user, notes: nil)
      update!(
        status: "resolved",
        resolved_by: user,
        resolved_at: Time.current,
        resolution_notes: notes
      )
    end

    # Dismiss as false positive
    def dismiss!(user, reason: nil)
      update!(
        status: "dismissed",
        resolved_by: user,
        resolved_at: Time.current,
        resolution_notes: reason || "Dismissed as false positive"
      )
    end

    # Detect anomalies for a record
    def self.detect_for!(record, company)
      rules = company.gl_anomaly_rules.active.where(entity_type: record.class.name.demodulize.underscore)
      anomalies = []

      rules.each do |rule|
        if rule.matches?(record)
          anomalies << create!(
            corporate: company,
            anomalable: record,
            anomaly_type: rule.rule_type,
            severity: rule.severity,
            description: rule.generate_description(record),
            anomaly_score: rule.calculate_score(record),
            details: rule.extract_details(record)
          )
          rule.increment!(:trigger_count)
        end
      end

      # Built-in anomaly checks
      anomalies += detect_builtin_anomalies(record, company)

      anomalies
    end

    def self.detect_builtin_anomalies(record, company)
      anomalies = []

      case record
      when Gl::Invoice
        # Large invoice check
        avg_invoice = company.gl_invoices.where(invoice_type: record.invoice_type).average(:total) || 0
        if record.total > avg_invoice * 3 && avg_invoice > 0
          anomalies << create!(
            corporate: company,
            anomalable: record,
            anomaly_type: "unusual_amount",
            severity: "high",
            description: "Invoice amount (#{record.total}) is #{(record.total / avg_invoice).round(1)}x the average",
            anomaly_score: 0.8,
            comparison_data: { average: avg_invoice, current: record.total }
          )
        end

      when Gl::Payment
        # Payment without invoice
        if record.allocations.empty? && record.amount > 1000
          anomalies << create!(
            corporate: company,
            anomalable: record,
            anomaly_type: "pattern_break",
            severity: "medium",
            description: "Large payment (#{record.amount}) has no invoice allocations",
            anomaly_score: 0.6
          )
        end
      end

      anomalies
    end

    # Summary stats
    def self.summary(company)
      base = where(corporate: company)

      {
        total_open: base.open.count,
        by_severity: base.open.group(:severity).count,
        by_type: base.open.group(:anomaly_type).count,
        resolved_this_week: base.where(status: "resolved")
                                .where("resolved_at >= ?", 1.week.ago).count,
        critical_unresolved: base.critical.unresolved.count
      }
    end
  end
end
