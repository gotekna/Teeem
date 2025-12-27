# frozen_string_literal: true

# WorkerProfile - Unified employee/subcontractor profile for cost tracking
#
# Part of Site Presence & Cost Intelligence System
# See: .claude/plans/piped-orbiting-whisper.md
#
# This model unifies employees (via User) and subcontractors (via Contact)
# into a single profile for time tracking and cost allocation.
#
# Key Features:
# - Polymorphic identity (user_id for employees, contact_id for subbies)
# - Face verification via AWS Rekognition
# - simPRO-style rate configuration (hourly, overtime, day rate)
# - Employment cost loading (super, leave, workers comp)
#
class WorkerProfile < ApplicationRecord
  # Worker types
  WORKER_TYPES = %w[employee subcontractor contractor].freeze

  # Employment cost components (Australian defaults)
  EMPLOYMENT_COST_COMPONENTS = {
    superannuation: 0.115,     # 11.5% (2024 rate)
    workers_comp: 0.02,        # 2% estimate
    annual_leave: 0.0769,      # 4 weeks / 52 weeks
    personal_leave: 0.0384,    # 2 weeks / 52 weeks
    public_holidays: 0.0346    # 9 days / 260 work days
  }.freeze

  DEFAULT_EMPLOYMENT_COST_PERCENT = (EMPLOYMENT_COST_COMPONENTS.values.sum * 100).round(2)

  # Associations
  belongs_to :user, optional: true
  belongs_to :contact, optional: true
  belongs_to :cost_centre, optional: true

  has_many :site_presence_sessions, dependent: :destroy
  has_many :labour_cost_entries, dependent: :destroy
  has_many :ai_timesheet_suggestions, dependent: :destroy

  # Validations
  validates :worker_type, presence: true, inclusion: { in: WORKER_TYPES }
  validates :name, presence: true, length: { maximum: 100 }
  validates :hourly_rate, numericality: { greater_than: 0 }, allow_nil: true
  validates :day_rate, numericality: { greater_than: 0 }, allow_nil: true
  validates :employment_cost_percent,
            numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 100 },
            allow_nil: true
  validates :abn, format: { with: /\A\d{11}\z/, message: "must be 11 digits" }, allow_blank: true

  # Ensure exactly one of user or contact is set
  validate :exactly_one_identity

  # Scopes
  scope :active, -> { where(active: true) }
  scope :inactive, -> { where(active: false) }
  scope :employees, -> { where(worker_type: "employee") }
  scope :subcontractors, -> { where(worker_type: %w[subcontractor contractor]) }
  scope :with_face_verified, -> { where(face_verified: true) }
  scope :ordered, -> { order(:name) }

  # Callbacks
  before_validation :set_name_from_identity, if: -> { name.blank? }
  before_validation :set_default_employment_cost, on: :create

  # Type helpers
  def employee?
    worker_type == "employee"
  end

  def subcontractor?
    worker_type.in?(%w[subcontractor contractor])
  end

  # Rate helpers

  # Get effective hourly rate (or calculate from day rate)
  def effective_hourly_rate
    hourly_rate || (day_rate && day_rate / 8.0)
  end

  # Get 1.5x overtime rate (default to 1.5x hourly if not set)
  def effective_overtime_1_5x_rate
    overtime_rate_1_5x || (effective_hourly_rate && effective_hourly_rate * 1.5)
  end

  # Get 2x overtime rate (default to 2x hourly if not set)
  def effective_overtime_2x_rate
    overtime_rate_2x || (effective_hourly_rate && effective_hourly_rate * 2.0)
  end

  # Get weekend rate (default to 1.5x hourly if not set)
  def effective_weekend_rate
    weekend_rate || (effective_hourly_rate && effective_hourly_rate * 1.5)
  end

  # Get employment cost as decimal (0.285 not 28.5)
  def employment_cost_decimal
    return 0 if subcontractor?

    (employment_cost_percent || DEFAULT_EMPLOYMENT_COST_PERCENT) / 100.0
  end

  # Face verification helpers

  def face_photo_uploaded?
    profile_photo_url.present?
  end

  def can_verify_face?
    face_photo_uploaded? && !face_verified?
  end

  # Cost calculation - returns hash with cost breakdown
  def calculate_cost_for_hours(hours_breakdown, cost_centre_override: nil)
    cc = cost_centre_override || cost_centre
    overhead_percent = cc&.total_overhead_percent || 0

    # Base labour cost
    base_cost = 0
    base_cost += (hours_breakdown[:regular] || 0) * (effective_hourly_rate || 0)
    base_cost += (hours_breakdown[:overtime_1_5x] || 0) * (effective_overtime_1_5x_rate || 0)
    base_cost += (hours_breakdown[:overtime_2x] || 0) * (effective_overtime_2x_rate || 0)

    # Employment cost loading (skip for subcontractors)
    employment_cost = base_cost * employment_cost_decimal

    # Overhead allocation
    overhead_cost = (base_cost + employment_cost) * (overhead_percent / 100.0)

    # Total fully-loaded cost
    total_cost = base_cost + employment_cost + overhead_cost

    {
      base_labour_cost: base_cost.round(2),
      employment_cost: employment_cost.round(2),
      overhead_cost: overhead_cost.round(2),
      total_cost: total_cost.round(2),
      rates_used: {
        hourly_rate: effective_hourly_rate,
        overtime_1_5x_rate: effective_overtime_1_5x_rate,
        overtime_2x_rate: effective_overtime_2x_rate,
        employment_cost_percent: employee? ? (employment_cost_percent || DEFAULT_EMPLOYMENT_COST_PERCENT) : 0,
        overhead_percent: overhead_percent
      }
    }
  end

  # Get active session for this worker
  def active_session
    site_presence_sessions.where(session_status: "active").order(:checkin_at).last
  end

  # Check if worker is currently checked in
  def checked_in?
    active_session.present?
  end

  # Class methods

  # Find or create worker profile for a user
  def self.for_user(user)
    find_or_create_by(user: user) do |wp|
      wp.worker_type = "employee"
      wp.name = user.name
    end
  end

  # Find or create worker profile for a contact (subcontractor)
  def self.for_contact(contact)
    find_or_create_by(contact: contact) do |wp|
      wp.worker_type = "subcontractor"
      wp.name = contact.name
    end
  end

  private

  def exactly_one_identity
    return if user_id.present? ^ contact_id.present?

    errors.add(:base, "Must have exactly one of user or contact")
  end

  def set_name_from_identity
    self.name = user&.name || contact&.name
  end

  def set_default_employment_cost
    return unless employee? && employment_cost_percent.nil?

    self.employment_cost_percent = DEFAULT_EMPLOYMENT_COST_PERCENT
  end
end
