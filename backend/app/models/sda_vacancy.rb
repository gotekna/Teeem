class SdaVacancy < ApplicationRecord
  acts_as_tenant :tenant

  belongs_to :property
  belongs_to :tenancy, optional: true

  has_many :sda_participant_matches, dependent: :destroy

  STATUSES = %w[open notified listed filled closed].freeze
  VACANCY_REASONS = %w[tenant_vacated lease_expired eviction never_occupied].freeze

  validates :status, presence: true, inclusion: { in: STATUSES }
  validates :vacancy_reason, inclusion: { in: VACANCY_REASONS }, allow_nil: true
  validates :vacancy_start_date, presence: true

  scope :active, -> { where(status: %w[open notified listed]) }
  scope :filled, -> { where(status: "filled") }

  def days_vacant
    end_date = vacancy_end_date || Date.current
    (end_date - vacancy_start_date).to_i
  end

  def fill!(new_tenancy)
    update!(
      status: "filled",
      tenancy: new_tenancy,
      vacancy_end_date: Date.current
    )
  end

  def calculate_lost_income
    return 0 unless daily_lost_income&.positive?
    (days_vacant * daily_lost_income).round(2)
  end

  def notify_ndia!
    update!(
      status: "notified",
      ndia_notified: true,
      ndia_notified_date: Date.current
    )
  end

  def overdue_notification?
    return false unless status == "open"
    return false unless vacancy_start_date

    business_days = 0
    date = vacancy_start_date
    while date < Date.current
      business_days += 1 unless date.saturday? || date.sunday?
      date += 1.day
    end
    business_days > 5
  end
end
