# frozen_string_literal: true

module Gl
  # Configurable rules for anomaly detection
  class AnomalyRule < ApplicationRecord
    self.table_name = "gl_anomaly_rules"

    RULE_TYPES = %w[threshold pattern statistical timing].freeze
    ENTITY_TYPES = %w[invoice payment journal bank_transaction expense].freeze

    belongs_to :corporate_company, class_name: "Corporate", foreign_key: "company_id"

    validates :name, presence: true
    validates :rule_type, presence: true, inclusion: { in: RULE_TYPES }
    validates :entity_type, presence: true, inclusion: { in: ENTITY_TYPES }
    validates :conditions, presence: true

    scope :active, -> { where(active: true) }
    scope :for_entity, ->(entity) { where(entity_type: entity) }

    # Check if record matches this rule
    def matches?(record)
      case rule_type
      when "threshold"
        check_threshold(record)
      when "pattern"
        check_pattern(record)
      when "statistical"
        check_statistical(record)
      when "timing"
        check_timing(record)
      else
        false
      end
    rescue StandardError
      false
    end

    # Generate description for matched anomaly
    def generate_description(record)
      template = conditions["description_template"] || name
      template.gsub(/\{(\w+)\}/) { |_| record.try($1) || "N/A" }
    end

    # Calculate anomaly score
    def calculate_score(record)
      return 0.5 unless conditions["score_field"]

      field = conditions["score_field"]
      threshold = conditions["threshold"]&.to_f || 0
      value = record.try(field)&.to_f || 0

      return 0.5 if threshold.zero?

      deviation = (value - threshold).abs / threshold
      [deviation / 2, 1.0].min
    end

    # Extract relevant details
    def extract_details(record)
      fields = conditions["detail_fields"] || []
      fields.to_h { |f| [f, record.try(f)] }
    end

    # Seed default rules
    def self.seed_defaults!(company)
      defaults = [
        {
          name: "Large Invoice",
          rule_type: "threshold",
          entity_type: "invoice",
          conditions: {
            field: "total",
            operator: "gt",
            threshold: 50_000,
            score_field: "total",
            description_template: "Invoice {number} has unusually large total of {total}"
          },
          severity: "high"
        },
        {
          name: "Unusual Payment Time",
          rule_type: "timing",
          entity_type: "payment",
          conditions: {
            time_field: "created_at",
            outside_hours: [6, 22],
            description_template: "Payment {id} created outside business hours"
          },
          severity: "medium"
        },
        {
          name: "Round Number Transaction",
          rule_type: "pattern",
          entity_type: "bank_transaction",
          conditions: {
            field: "amount",
            pattern: "round_thousands",
            min_amount: 10_000,
            description_template: "Round number transaction of {amount}"
          },
          severity: "low"
        },
        {
          name: "Rapid Journal Entries",
          rule_type: "statistical",
          entity_type: "journal",
          conditions: {
            count_window: 3600, # 1 hour
            max_count: 20,
            description_template: "More than 20 journal entries in 1 hour"
          },
          severity: "medium"
        }
      ]

      defaults.each do |rule|
        find_or_create_by!(corporate_company: company, name: rule[:name]) do |r|
          r.assign_attributes(rule)
        end
      end
    end

    private

    def check_threshold(record)
      field = conditions["field"]
      operator = conditions["operator"]
      threshold = conditions["threshold"].to_f
      value = record.try(field).to_f

      case operator
      when "gt" then value > threshold
      when "lt" then value < threshold
      when "gte" then value >= threshold
      when "lte" then value <= threshold
      when "eq" then value == threshold
      else false
      end
    end

    def check_pattern(record)
      field = conditions["field"]
      pattern = conditions["pattern"]
      value = record.try(field)

      case pattern
      when "round_thousands"
        min_amount = conditions["min_amount"] || 1000
        value.to_f >= min_amount && (value.to_f % 1000).zero?
      when "sequential"
        # Check for sequential numbers (fraud indicator)
        value.to_s.chars.each_cons(2).all? { |a, b| b.to_i == a.to_i + 1 }
      when "regex"
        regex = Regexp.new(conditions["regex"])
        value.to_s.match?(regex)
      else
        false
      end
    end

    def check_statistical(record)
      count_window = conditions["count_window"].to_i.seconds
      max_count = conditions["max_count"].to_i

      # Count similar records in the window
      model = record.class
      count = model.where(corporate_company_id: corporate_company_id)
                   .where("created_at >= ?", record.created_at - count_window)
                   .where("created_at <= ?", record.created_at)
                   .count

      count > max_count
    end

    def check_timing(record)
      time_field = conditions["time_field"]
      outside_hours = conditions["outside_hours"] || []

      time = record.try(time_field)
      return false unless time.respond_to?(:hour)

      hour = time.hour
      start_hour, end_hour = outside_hours

      return false unless start_hour && end_hour

      hour < start_hour || hour > end_hour
    end
  end
end
