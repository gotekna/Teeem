# frozen_string_literal: true

# SitePresenceSession - Photo-verified site check-in/checkout tracking
#
# Part of Site Presence & Cost Intelligence System
# See: .claude/plans/piped-orbiting-whisper.md
#
# Combines GPS verification with photo-based face verification for
# bulletproof time tracking that prevents buddy punching.
#
# Key Features:
# - Photo-based check-in/checkout with face verification
# - GPS distance calculation from job site
# - Automatic time calculation with break handling
# - Approval workflow with anomaly detection
# - Auto-generates LabourCostEntry on completion
#
class SitePresenceSession < ApplicationRecord
  # Session statuses
  SESSION_STATUSES = %w[active completed incomplete cancelled].freeze

  # Approval statuses
  APPROVAL_STATUSES = %w[pending approved rejected auto_approved].freeze

  # Associations
  belongs_to :worker_profile
  belongs_to :job
  belongs_to :sm_task, optional: true
  belongs_to :cost_centre, optional: true
  belongs_to :checkin_photo, class_name: "SmTaskPhoto", optional: true
  belongs_to :checkout_photo, class_name: "SmTaskPhoto", optional: true
  belongs_to :approved_by, class_name: "User", optional: true

  # SaaS customer association (for cost-to-serve tracking)
  belongs_to :saas_customer, class_name: "Contact", optional: true

  has_one :labour_cost_entry, dependent: :destroy

  # Live location tracking
  has_many :location_pings, dependent: :destroy
  has_many :geofence_events, dependent: :destroy

  # Validations
  validates :session_status, presence: true, inclusion: { in: SESSION_STATUSES }
  validates :approval_status, inclusion: { in: APPROVAL_STATUSES }
  validates :checkin_at, presence: true
  validates :total_hours, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true
  validates :break_minutes, numericality: { greater_than_or_equal_to: 0 }

  # Scopes
  scope :active, -> { where(session_status: "active") }
  scope :completed, -> { where(session_status: "completed") }
  scope :incomplete, -> { where(session_status: "incomplete") }
  scope :pending_approval, -> { where(approval_status: "pending") }
  scope :approved, -> { where(approval_status: %w[approved auto_approved]) }
  scope :rejected, -> { where(approval_status: "rejected") }
  scope :for_date, ->(date) { where(checkin_at: date.beginning_of_day..date.end_of_day) }
  scope :for_job, ->(job_id) { where(job_id: job_id) }
  scope :for_worker, ->(worker_profile_id) { where(worker_profile_id: worker_profile_id) }
  scope :recent, -> { order(checkin_at: :desc) }
  scope :today, -> { for_date(Date.current) }
  scope :with_anomalies, -> { where("jsonb_array_length(anomalies) > 0") }

  # Callbacks
  before_create :set_cost_centre_from_job
  after_save :create_labour_cost_entry_if_completed, if: :saved_change_to_session_status?

  # Check-in method
  # @param saas_customer_id [Integer, nil] SaaS customer being supported (for cost-to-serve tracking)
  def self.check_in(worker_profile:, job:, latitude:, longitude:, photo: nil, task: nil, device_info: nil, saas_customer_id: nil)
    session = new(
      worker_profile: worker_profile,
      job: job,
      sm_task: task,
      saas_customer_id: saas_customer_id,
      checkin_at: Time.current,
      latitude_checkin: latitude,
      longitude_checkin: longitude,
      checkin_photo: photo,
      device_info: device_info,
      session_status: "active",
      approval_status: "pending"
    )

    # Calculate distance from job site
    session.calculate_checkin_distance

    # Verify GPS
    session.gps_verified_checkin = session.within_site_radius?(:checkin)

    session.save!
    session
  end

  # Check-out method
  def check_out(latitude:, longitude:, photo: nil)
    return false unless active?

    update!(
      checkout_at: Time.current,
      latitude_checkout: latitude,
      longitude_checkout: longitude,
      checkout_photo: photo,
      session_status: "completed"
    )

    calculate_checkout_distance
    self.gps_verified_checkout = within_site_radius?(:checkout)

    calculate_hours
    detect_anomalies
    save!

    true
  end

  # Status helpers
  def active?
    session_status == "active"
  end

  def completed?
    session_status == "completed"
  end

  def incomplete?
    session_status == "incomplete"
  end

  # Approval methods
  def approve!(user)
    update!(
      approval_status: "approved",
      approved_by: user,
      approved_at: Time.current
    )
  end

  def reject!(user, reason:)
    update!(
      approval_status: "rejected",
      approved_by: user,
      approved_at: Time.current,
      rejection_reason: reason
    )
  end

  def auto_approve!
    update!(
      approval_status: "auto_approved",
      approved_at: Time.current
    )
  end

  # GPS helpers
  def calculate_checkin_distance
    return unless job.site_latitude && job.site_longitude && latitude_checkin && longitude_checkin

    self.distance_from_site_checkin = haversine_distance(
      latitude_checkin, longitude_checkin,
      job.site_latitude, job.site_longitude
    )
  end

  def calculate_checkout_distance
    return unless job.site_latitude && job.site_longitude && latitude_checkout && longitude_checkout

    self.distance_from_site_checkout = haversine_distance(
      latitude_checkout, longitude_checkout,
      job.site_latitude, job.site_longitude
    )
  end

  def within_site_radius?(type = :checkin)
    distance = type == :checkin ? distance_from_site_checkin : distance_from_site_checkout
    return true if distance.nil? # No distance means no GPS requirement

    distance <= (job.site_radius_meters || 100)
  end

  # Time calculation
  def calculate_hours
    return unless checkin_at && checkout_at

    total = (checkout_at - checkin_at) / 1.hour
    total -= (break_minutes || 0) / 60.0

    self.total_hours = [total, 0].max.round(2)
    self.billable_hours = total_hours # Can be adjusted for non-billable time
  end

  # Duration in human-readable format
  def duration_display
    return "In progress" unless total_hours

    hours = total_hours.floor
    minutes = ((total_hours - hours) * 60).round
    "#{hours}h #{minutes}m"
  end

  # Anomaly detection
  def detect_anomalies
    self.anomalies = []

    # Excessive hours (>12h)
    if total_hours && total_hours > 12
      anomalies << {
        type: "excessive_hours",
        severity: "warning",
        message: "Session of #{total_hours.round(1)} hours exceeds 12 hour threshold"
      }
    end

    # Short session (<30min)
    if total_hours && total_hours < 0.5
      anomalies << {
        type: "short_session",
        severity: "info",
        message: "Session of #{(total_hours * 60).round} minutes is very short"
      }
    end

    # Location mismatch (>500m)
    if distance_from_site_checkin && distance_from_site_checkin > 500
      anomalies << {
        type: "location_mismatch",
        severity: "critical",
        message: "Check-in location #{distance_from_site_checkin}m from job site"
      }
    end

    # Unusual checkin time (before 5am or after 10pm)
    if checkin_at
      hour = checkin_at.hour
      if hour < 5 || hour > 22
        anomalies << {
          type: "unusual_checkin_time",
          severity: "warning",
          message: "Check-in at unusual hour: #{checkin_at.strftime('%H:%M')}"
        }
      end
    end

    # Face verification failed
    if job.require_face_verification && !face_verified_checkin
      anomalies << {
        type: "face_mismatch",
        severity: "critical",
        message: "Face verification failed at check-in"
      }
    end
  end

  def has_anomalies?
    anomalies.present? && anomalies.any?
  end

  def critical_anomalies?
    anomalies.present? && anomalies.any? { |a| a["severity"] == "critical" }
  end

  private

  def set_cost_centre_from_job
    self.cost_centre ||= job&.cost_centre
  end

  def create_labour_cost_entry_if_completed
    return unless session_status == "completed" && labour_cost_entry.nil?

    LabourCostEntry.create_from_session(self)
  end

  def haversine_distance(lat1, lon1, lat2, lon2)
    rad_per_deg = Math::PI / 180
    earth_radius_meters = 6_371_000

    dlat = (lat2 - lat1) * rad_per_deg
    dlon = (lon2 - lon1) * rad_per_deg

    a = Math.sin(dlat / 2)**2 +
        Math.cos(lat1 * rad_per_deg) * Math.cos(lat2 * rad_per_deg) *
        Math.sin(dlon / 2)**2

    c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    (earth_radius_meters * c).round(0)
  end
end
