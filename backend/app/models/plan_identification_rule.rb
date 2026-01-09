# frozen_string_literal: true

# Learned rules for plan identification
# These are extracted from human corrections and improve pattern matching over time
class PlanIdentificationRule < ApplicationRecord
  belongs_to :plan_type
  belongs_to :created_by, class_name: "User", optional: true

  # Rule types
  RULE_TYPES = %w[keyword pattern exclusion].freeze

  validates :rule_type, inclusion: { in: RULE_TYPES }
  validates :match_text, presence: true
  validates :match_text, uniqueness: { scope: :plan_type_id, message: "already exists for this plan type" }

  scope :active, -> { where(is_active: true) }
  scope :by_priority, -> { order(priority: :desc) }
  scope :keywords, -> { where(rule_type: "keyword") }
  scope :patterns, -> { where(rule_type: "pattern") }
  scope :exclusions, -> { where(rule_type: "exclusion") }

  # Find matching rules for a given text
  def self.find_matches(text)
    normalized = text.to_s.downcase.strip
    return none if normalized.blank?

    active.by_priority.select do |rule|
      case rule.rule_type
      when "keyword"
        normalized.include?(rule.match_text.downcase)
      when "pattern"
        normalized =~ Regexp.new(rule.match_text, Regexp::IGNORECASE)
      when "exclusion"
        false  # Exclusions are handled differently
      end
    end
  end

  # Check if text should be excluded from a plan type
  def self.excluded?(text, plan_type)
    normalized = text.to_s.downcase.strip
    active.exclusions.where(plan_type: plan_type).exists?(["LOWER(match_text) = ?", normalized])
  end

  # Record a successful match
  def record_success!
    increment!(:success_count)
  end

  # Record a failed match (human override)
  def record_failure!
    increment!(:failure_count)
    # Auto-deactivate rules with high failure rate
    deactivate! if failure_rate > 0.3 && total_uses > 10
  end

  def failure_rate
    return 0 if total_uses.zero?
    failure_count.to_f / total_uses
  end

  def total_uses
    success_count + failure_count
  end

  def deactivate!
    update!(is_active: false)
    Rails.logger.info "[PlanIdentificationRule] Auto-deactivated rule ##{id}: #{match_text} (failure rate: #{(failure_rate * 100).round(1)}%)"
  end

  # Create a new rule from a human correction
  def self.create_from_correction!(match_text:, plan_type:, created_by: nil)
    create!(
      rule_type: "keyword",
      match_text: match_text.downcase.strip,
      plan_type: plan_type,
      priority: 50,  # Medium priority for new rules
      created_by: created_by
    )
  rescue ActiveRecord::RecordNotUnique
    # Rule already exists, just return it
    find_by!(match_text: match_text.downcase.strip, plan_type: plan_type)
  end
end
