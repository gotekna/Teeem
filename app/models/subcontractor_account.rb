class SubcontractorAccount < ApplicationRecord
  # Associations
  belongs_to :portal_user
  belongs_to :invited_by_contact, class_name: 'Contact', optional: true
  has_many :kudos_events, dependent: :destroy

  # Enums
  enum account_tier: { free: 'free', paid: 'paid' }

  # Validations
  validates :portal_user_id, presence: true, uniqueness: true
  validates :account_tier, presence: true
  validates :kudos_score, numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 1000 }
  validates :jobs_completed_count, numericality: { greater_than_or_equal_to: 0 }

  # Callbacks
  before_create :set_activation_date

  # Scopes
  scope :active, -> { where.not(activated_at: nil) }
  scope :free_tier, -> { where(account_tier: 'free') }
  scope :paid_tier, -> { where(account_tier: 'paid') }
  scope :top_performers, -> { order(kudos_score: :desc) }

  # Instance Methods
  def activate!
    update!(activated_at: Time.current) unless activated_at.present?
  end

  def active?
    activated_at.present?
  end

  def can_upgrade?
    free? && active?
  end

  def recalculate_kudos_score!
    total_points = kudos_events.sum(:points_awarded)

    # Apply exponential decay - recent events weighted higher
    weighted_score = kudos_events.recent.limit(50).sum do |event|
      age_days = (Time.current - event.created_at) / 1.day
      decay_factor = Math.exp(-age_days / 90.0) # 90-day half-life
      event.points_awarded * decay_factor
    end

    # Normalize to 0-1000 scale
    normalized_score = [[weighted_score, 0].max, 1000].min

    update_column(:kudos_score, normalized_score.round(2))
  end

  def kudos_breakdown
    {
      quote_response: kudos_events.quote_submitted.sum(:points_awarded),
      arrival_punctuality: kudos_events.where(event_type: %w[arrived_on_time arrived_late]).sum(:points_awarded),
      completion_timeliness: kudos_events.where(event_type: %w[completed_on_time completed_late]).sum(:points_awarded),
      quality: kudos_events.quality_rating.sum(:points_awarded),
      total: kudos_score
    }
  end

  private

  def set_activation_date
    self.activated_at ||= Time.current
  end
end
