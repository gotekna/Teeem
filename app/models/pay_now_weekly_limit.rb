# == Schema Information
#
# Table name: pay_now_weekly_limits
#
#  id               :bigint           not null, primary key
#  total_limit      :decimal(15, 2)   default(0.0), not null
#  used_amount      :decimal(15, 2)   default(0.0), not null
#  remaining_amount :decimal(15, 2)   default(0.0), not null
#  week_start_date  :date             not null
#  week_end_date    :date             not null
#  active           :boolean          default(TRUE), not null
#  set_by_id        :bigint
#  previous_limit   :decimal(15, 2)
#  created_at       :datetime         not null
#  updated_at       :datetime         not null
#

class PayNowWeeklyLimit < ApplicationRecord
  # Relationships
  belongs_to :set_by, class_name: 'User', optional: true
  has_many :pay_now_requests, dependent: :nullify

  # Validations
  validates :total_limit, presence: true, numericality: { greater_than_or_equal_to: 0 }
  validates :used_amount, presence: true, numericality: { greater_than_or_equal_to: 0 }
  validates :remaining_amount, presence: true, numericality: { greater_than_or_equal_to: 0 }
  validates :week_start_date, presence: true
  validates :week_end_date, presence: true
  validate :week_end_after_start

  # Callbacks
  before_validation :calculate_remaining_amount
  before_validation :set_week_dates, on: :create

  # Scopes
  scope :active, -> { where(active: true) }
  scope :for_week, ->(date) { where('week_start_date <= ? AND week_end_date >= ?', date, date) }
  scope :current_week, -> {
    today = CompanySetting.today
    for_week(today).active.first
  }

  # Class methods
  def self.current
    # Get or create current week's limit
    today = CompanySetting.today
    week_start = today.beginning_of_week(:monday)

    current_limit = for_week(week_start).active.first

    unless current_limit
      # Create new week limit with previous week's total or default to 0
      previous_limit_value = PayNowWeeklyLimit.where(active: true)
                                              .where('week_start_date < ?', week_start)
                                              .order(week_start_date: :desc)
                                              .limit(1)
                                              .pluck(:total_limit)
                                              .first || 0.0

      current_limit = create!(
        total_limit: previous_limit_value,
        week_start_date: week_start,
        week_end_date: week_start.end_of_week(:monday),
        active: true
      )
    end

    current_limit
  end

  def self.set_limit(amount, user:)
    # Set new limit for current week
    today = CompanySetting.today
    week_start = today.beginning_of_week(:monday)

    transaction do
      # Deactivate any existing limits for this week
      where('week_start_date = ?', week_start).update_all(active: false)

      # Get current usage if there was an active limit
      current_usage = PayNowRequest.where(status: ['approved', 'paid'])
                                   .where('created_at >= ? AND created_at <= ?', week_start, week_start.end_of_week(:monday))
                                   .sum(:discounted_amount)

      # Create new limit
      create!(
        total_limit: amount,
        used_amount: current_usage,
        week_start_date: week_start,
        week_end_date: week_start.end_of_week(:monday),
        set_by: user,
        previous_limit: PayNowWeeklyLimit.where(active: false)
                                        .where('week_start_date = ?', week_start)
                                        .order(created_at: :desc)
                                        .limit(1)
                                        .pluck(:total_limit)
                                        .first,
        active: true
      )
    end
  end

  # Instance methods
  def check_availability(amount)
    reload # Ensure we have latest data
    remaining_amount >= amount
  end

  def reserve_amount(amount)
    # Atomic update to prevent race conditions
    lock!
    reload

    if remaining_amount >= amount
      increment!(:used_amount, amount)
      decrement!(:remaining_amount, amount)
      true
    else
      false
    end
  end

  def release_amount(amount)
    # Release reserved amount (e.g., if request is cancelled/rejected)
    lock!
    reload

    decrement!(:used_amount, amount)
    increment!(:remaining_amount, amount)
  end

  def utilization_percentage
    return 0 if total_limit.zero?
    ((used_amount / total_limit) * 100).round(2)
  end

  def formatted_total_limit
    "$#{total_limit.round(2)}"
  end

  def formatted_used_amount
    "$#{used_amount.round(2)}"
  end

  def formatted_remaining_amount
    "$#{remaining_amount.round(2)}"
  end

  private

  def calculate_remaining_amount
    self.remaining_amount = total_limit - used_amount
  end

  def set_week_dates
    return if week_start_date.present? && week_end_date.present?

    today = CompanySetting.today
    self.week_start_date = today.beginning_of_week(:monday)
    self.week_end_date = today.end_of_week(:monday)
  end

  def week_end_after_start
    if week_end_date.present? && week_start_date.present? && week_end_date < week_start_date
      errors.add(:week_end_date, 'must be after week start date')
    end
  end
end
