# frozen_string_literal: true

module Gl
  class ReconciliationRule < ApplicationRecord
    self.table_name = 'gl_reconciliation_rules'

    # ═══════════════════════════════════════════════════════════════
    # ASSOCIATIONS
    # ═══════════════════════════════════════════════════════════════
    belongs_to :corporate_company, class_name: "Corporate"
    belongs_to :gl_account, class_name: 'Gl::Account', optional: true  # Specific bank or all
    belongs_to :target_account, class_name: 'Gl::Account', optional: true

    # ═══════════════════════════════════════════════════════════════
    # CONSTANTS
    # ═══════════════════════════════════════════════════════════════
    RULE_TYPES = %w[description_match amount_match reference_match combined].freeze
    MATCH_FIELDS = %w[description reference amount].freeze
    MATCH_OPERATORS = %w[contains equals starts_with ends_with regex].freeze

    # ═══════════════════════════════════════════════════════════════
    # VALIDATIONS
    # ═══════════════════════════════════════════════════════════════
    validates :name, presence: true
    validates :rule_type, presence: true, inclusion: { in: RULE_TYPES }
    validates :match_field, inclusion: { in: MATCH_FIELDS }, allow_blank: true
    validates :match_operator, inclusion: { in: MATCH_OPERATORS }, allow_blank: true

    # ═══════════════════════════════════════════════════════════════
    # SCOPES
    # ═══════════════════════════════════════════════════════════════
    scope :active, -> { where(active: true) }
    scope :for_account, ->(account_id) {
      where(gl_account_id: [ nil, account_id ])
    }
    scope :by_priority, -> { order(priority: :desc, times_used: :desc) }

    # ═══════════════════════════════════════════════════════════════
    # INSTANCE METHODS
    # ═══════════════════════════════════════════════════════════════

    # Check if a reconciliation line matches this rule
    def matches?(line)
      case rule_type
      when 'description_match'
        matches_field?(line.description, match_operator, match_value)
      when 'reference_match'
        matches_field?(line.reference, match_operator, match_value)
      when 'amount_match'
        matches_amount?(line.amount)
      when 'combined'
        matches_combined?(line)
      else
        false
      end
    end

    # Record usage of this rule
    def record_usage!
      increment!(:times_used)
      update_column(:last_used_at, Time.current)
    end

    # Apply the rule to categorize a transaction
    def apply_to(line)
      {
        target_account: target_account,
        tax_type: tax_type,
        description: default_description.presence || line.description
      }
    end

    private

    def matches_field?(value, operator, pattern)
      return false if value.blank? || pattern.blank?

      value = value.to_s.downcase
      pattern = pattern.to_s.downcase

      case operator
      when 'contains'
        value.include?(pattern)
      when 'equals'
        value == pattern
      when 'starts_with'
        value.start_with?(pattern)
      when 'ends_with'
        value.end_with?(pattern)
      when 'regex'
        value.match?(Regexp.new(pattern, Regexp::IGNORECASE))
      else
        false
      end
    rescue RegexpError
      false
    end

    def matches_amount?(value)
      return false if value.blank? || match_value.blank?

      target_amount = match_value.to_d
      tolerance = amount_tolerance || 0

      (value.to_d - target_amount).abs <= tolerance
    end

    def matches_combined?(line)
      # For combined rules, check multiple conditions from match_value as JSON
      conditions = JSON.parse(match_value) rescue []

      conditions.all? do |condition|
        field = condition['field']
        operator = condition['operator']
        value = condition['value']

        case field
        when 'description'
          matches_field?(line.description, operator, value)
        when 'reference'
          matches_field?(line.reference, operator, value)
        when 'amount'
          matches_amount?(line.amount)
        else
          false
        end
      end
    end
  end
end
