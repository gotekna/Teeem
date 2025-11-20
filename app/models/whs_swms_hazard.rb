class WhsSwmsHazard < ApplicationRecord
  # Associations
  belongs_to :whs_swms
  has_many :whs_swms_controls, dependent: :destroy

  # Constants
  RISK_LEVELS = %w[low medium high extreme].freeze

  # Validations
  validates :hazard_description, presence: true
  validates :likelihood, presence: true, inclusion: { in: 1..5 }
  validates :consequence, presence: true, inclusion: { in: 1..5 }
  validates :risk_score, presence: true
  validates :risk_level, inclusion: { in: RISK_LEVELS }, allow_nil: true
  validates :position, numericality: { greater_than_or_equal_to: 0 }

  # Callbacks
  before_validation :calculate_risk_score
  before_validation :calculate_risk_level

  # Scopes
  scope :by_risk_level, ->(level) { where(risk_level: level) }
  scope :high_risk, -> { where(risk_level: ['high', 'extreme']) }
  scope :ordered, -> { order(:position) }

  # Helper methods
  def high_risk?
    risk_level.in?(['high', 'extreme'])
  end

  def extreme_risk?
    risk_level == 'extreme'
  end

  def residual_risk_after_controls
    # Get the lowest residual risk from all controls
    whs_swms_controls.minimum(:residual_risk_score) || risk_score
  end

  private

  def calculate_risk_score
    return unless likelihood.present? && consequence.present?
    self.risk_score = likelihood * consequence
  end

  def calculate_risk_level
    return unless risk_score.present?

    self.risk_level = case risk_score
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
