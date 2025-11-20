class KudosEvent < ApplicationRecord
  # Associations
  belongs_to :subcontractor_account
  belongs_to :quote_response, optional: true
  belongs_to :purchase_order, optional: true

  # Enums
  enum event_type: {
    quote_submitted: 'quote_submitted',
    quote_accepted: 'quote_accepted',
    job_confirmed: 'job_confirmed',
    arrived_on_time: 'arrived_on_time',
    arrived_late: 'arrived_late',
    completed_on_time: 'completed_on_time',
    completed_late: 'completed_late',
    quality_rating: 'quality_rating'
  }

  # Validations
  validates :subcontractor_account_id, presence: true
  validates :event_type, presence: true
  validates :points_awarded, numericality: true

  # Callbacks
  after_create :update_subcontractor_kudos_score

  # Scopes
  scope :positive, -> { where('points_awarded > 0') }
  scope :negative, -> { where('points_awarded < 0') }
  scope :recent, -> { order(created_at: :desc) }
  scope :for_account, ->(account_id) { where(subcontractor_account_id: account_id) }
  scope :by_type, ->(type) { where(event_type: type) }

  # Class Methods
  def self.record_arrival(purchase_order, actual_time)
    return unless purchase_order.contact&.subcontractor_account

    expected = purchase_order.scheduled_date
    return unless expected

    is_on_time = actual_time <= expected + 30.minutes
    points = is_on_time ? 50 : -25

    create!(
      subcontractor_account: purchase_order.contact.subcontractor_account,
      purchase_order: purchase_order,
      event_type: is_on_time ? 'arrived_on_time' : 'arrived_late',
      expected_time: expected,
      actual_time: actual_time,
      points_awarded: points
    )
  end

  def self.record_completion(purchase_order, actual_time)
    return unless purchase_order.contact&.subcontractor_account

    expected = purchase_order.expected_completion_date
    return unless expected

    is_on_time = actual_time <= expected
    points = is_on_time ? 100 : -50

    create!(
      subcontractor_account: purchase_order.contact.subcontractor_account,
      purchase_order: purchase_order,
      event_type: is_on_time ? 'completed_on_time' : 'completed_late',
      expected_time: expected,
      actual_time: actual_time,
      points_awarded: points
    )
  end

  # Instance Methods
  def late?
    return false unless expected_time && actual_time
    actual_time > expected_time
  end

  def time_difference_hours
    return nil unless expected_time && actual_time
    ((actual_time - expected_time) / 1.hour).round(2)
  end

  private

  def update_subcontractor_kudos_score
    subcontractor_account.recalculate_kudos_score!
  end
end
