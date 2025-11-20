class WhsSwmsControl < ApplicationRecord
  # Associations
  belongs_to :whs_swms_hazard

  # Constants
  CONTROL_TYPES = %w[elimination substitution engineering administrative ppe].freeze
  RISK_LEVELS = %w[low medium high extreme].freeze

  # Validations
  validates :control_description, presence: true
  validates :control_type, presence: true, inclusion: { in: CONTROL_TYPES }
  validates :position, numericality: { greater_than_or_equal_to: 0 }
  validates :residual_likelihood, inclusion: { in: 1..5 }, allow_nil: true
  validates :residual_consequence, inclusion: { in: 1..5 }, allow_nil: true

  # Callbacks
  before_validation :calculate_residual_risk
  before_validation :calculate_residual_risk_level

  # Scopes
  scope :by_control_type, ->(type) { where(control_type: type) }
  scope :ordered, -> { order(:position) }
  scope :elimination_controls, -> { where(control_type: 'elimination') }
  scope :ppe_controls, -> { where(control_type: 'ppe') }

  # Helper methods
  def hierarchy_order
    # Control hierarchy from most to least effective
    CONTROL_TYPES.index(control_type) || 99
  end

  def effective?
    return false unless residual_risk_score.present?

    original_risk = whs_swms_hazard.risk_score
    residual_risk_score < original_risk
  end

  def risk_reduction_percentage
    return 0 unless residual_risk_score.present?

    original_risk = whs_swms_hazard.risk_score.to_f
    return 0 if original_risk.zero?

    ((original_risk - residual_risk_score) / original_risk * 100).round(1)
  end

  private

  def calculate_residual_risk
    return unless residual_likelihood.present? && residual_consequence.present?
    self.residual_risk_score = residual_likelihood * residual_consequence
  end

  def calculate_residual_risk_level
    return unless residual_risk_score.present?

    self.residual_risk_level = case residual_risk_score
                                when 1..6
                                  'low'
                                when 7..12
                                  'medium'
                                when 13..20
                                  'high'
                                when 21..25
                                  'extreme'
                                else
                                  'low'
                                end
  end
end
