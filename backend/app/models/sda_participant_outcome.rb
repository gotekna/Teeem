class SdaParticipantOutcome < ApplicationRecord
  acts_as_tenant :tenant

  belongs_to :property
  belongs_to :contact
  belongs_to :tenancy, optional: true
  belongs_to :assessed_by_user, class_name: "User", optional: true

  OUTCOME_TYPES = %w[satisfaction_survey goal_review independence_assessment wellbeing_check].freeze
  GOALS_STATUSES = %w[on_track at_risk behind achieved].freeze

  validates :outcome_type, presence: true, inclusion: { in: OUTCOME_TYPES }
  validates :goals_status, inclusion: { in: GOALS_STATUSES }, allow_nil: true
  validates :assessment_date, presence: true
  validates :overall_satisfaction, numericality: { in: 1..5 }, allow_nil: true
  validates :housing_quality_rating, numericality: { in: 1..5 }, allow_nil: true
  validates :maintenance_response_rating, numericality: { in: 1..5 }, allow_nil: true
  validates :safety_rating, numericality: { in: 1..5 }, allow_nil: true
  validates :independence_rating, numericality: { in: 1..5 }, allow_nil: true
  validates :community_access_rating, numericality: { in: 1..5 }, allow_nil: true

  scope :recent, -> { order(assessment_date: :desc) }
  scope :by_type, ->(type) { where(outcome_type: type) }
  scope :needs_attention, -> { where(goals_status: %w[at_risk behind]) }

  def average_rating
    ratings = [
      overall_satisfaction,
      housing_quality_rating,
      maintenance_response_rating,
      safety_rating,
      independence_rating,
      community_access_rating
    ].compact

    return nil if ratings.empty?
    (ratings.sum.to_f / ratings.length).round(1)
  end

  def needs_attention?
    goals_status.in?(%w[at_risk behind])
  end
end
