# frozen_string_literal: true

# GeofenceEvent - Records when workers exit/enter job site geofence
#
# Part of Live Location Tracking System
# Tracks geofence breaches for:
# - Real-time alerts to supervisors
# - Time verification (actual on-site vs claimed)
# - Compliance reporting
# - Anomaly detection
#
class GeofenceEvent < ApplicationRecord
  # Event types
  EVENT_TYPES = %w[exit enter dwell_outside].freeze

  # Associations
  belongs_to :site_presence_session
  belongs_to :worker_profile
  belongs_to :job
  belongs_to :acknowledged_by, class_name: "User", optional: true

  # Validations
  validates :event_type, presence: true, inclusion: { in: EVENT_TYPES }
  validates :detected_at, presence: true
  validates :latitude, numericality: { greater_than_or_equal_to: -90, less_than_or_equal_to: 90 }, allow_nil: true
  validates :longitude, numericality: { greater_than_or_equal_to: -180, less_than_or_equal_to: 180 }, allow_nil: true

  # Scopes
  scope :exits, -> { where(event_type: "exit") }
  scope :enters, -> { where(event_type: "enter") }
  scope :unresolved, -> { where(resolved_at: nil) }
  scope :resolved, -> { where.not(resolved_at: nil) }
  scope :unacknowledged, -> { where(acknowledged: false) }
  scope :recent, -> { order(detected_at: :desc) }
  scope :today, -> { where("detected_at >= ?", Time.current.beginning_of_day) }
  scope :for_job, ->(job_id) { where(job_id: job_id) }

  # Callbacks
  after_create :broadcast_event
  after_create :send_notification, if: :exit_event?

  # Check if this is an exit event
  def exit_event?
    event_type == "exit"
  end

  # Check if this is an enter event
  def enter_event?
    event_type == "enter"
  end

  # Resolve this event (worker returned or session ended)
  def resolve!(resolved_time = Time.current)
    return if resolved_at.present?

    update!(
      resolved_at: resolved_time,
      duration_seconds: (resolved_time - detected_at).to_i
    )
  end

  # Acknowledge the event (supervisor reviewed it)
  def acknowledge!(user, notes = nil)
    update!(
      acknowledged: true,
      acknowledged_by: user,
      acknowledged_at: Time.current,
      acknowledgment_notes: notes
    )
  end

  # Get coordinates as array [lat, lng]
  def coordinates
    [latitude, longitude] if latitude && longitude
  end

  # Human-readable duration
  def duration_display
    return nil unless duration_seconds

    hours = duration_seconds / 3600
    minutes = (duration_seconds % 3600) / 60

    if hours > 0
      "#{hours}h #{minutes}m"
    else
      "#{minutes}m"
    end
  end

  private

  def broadcast_event
    LocationChannel.broadcast_geofence_event(self) if defined?(LocationChannel)
  end

  def send_notification
    GeofenceAlertJob.perform_later(id) if defined?(GeofenceAlertJob)
  end
end
