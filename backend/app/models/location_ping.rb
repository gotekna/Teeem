# frozen_string_literal: true

# LocationPing - Periodic GPS location updates from field workers
#
# Part of Live Location Tracking System
# Captures worker position throughout their shift for:
# - Real-time map visualization
# - Geofence monitoring
# - Route/path history
# - Time verification
#
# Only recorded during active SitePresenceSession (check-in to check-out)
#
class LocationPing < ApplicationRecord
  # Valid source types for location updates
  SOURCES = %w[foreground background significant_change manual].freeze

  # Battery states
  BATTERY_STATES = %w[charging unplugged full unknown].freeze

  # Associations
  belongs_to :site_presence_session
  belongs_to :worker_profile
  belongs_to :job

  # Validations
  validates :latitude, presence: true, numericality: { greater_than_or_equal_to: -90, less_than_or_equal_to: 90 }
  validates :longitude, presence: true, numericality: { greater_than_or_equal_to: -180, less_than_or_equal_to: 180 }
  validates :recorded_at, presence: true
  validates :source, inclusion: { in: SOURCES }, allow_nil: true
  validates :battery_state, inclusion: { in: BATTERY_STATES }, allow_nil: true
  validates :battery_level, numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 100 }, allow_nil: true

  # Scopes
  scope :recent, -> { order(recorded_at: :desc) }
  scope :chronological, -> { order(recorded_at: :asc) }
  scope :within_geofence, -> { where(within_geofence: true) }
  scope :outside_geofence, -> { where(within_geofence: false) }
  scope :for_session, ->(session_id) { where(site_presence_session_id: session_id) }
  scope :today, -> { where("recorded_at >= ?", Time.current.beginning_of_day) }

  # Callbacks
  before_save :calculate_distance_from_site, if: -> { latitude_changed? || longitude_changed? }
  before_save :determine_geofence_status, if: -> { distance_from_site_changed? }
  after_create :broadcast_location_update
  after_create :check_geofence_breach

  # Calculate distance from job site using Haversine formula
  def calculate_distance_from_site
    return unless job&.site_latitude && job&.site_longitude

    self.distance_from_site = haversine_distance(
      latitude, longitude,
      job.site_latitude, job.site_longitude
    )
  end

  # Determine if within job site geofence
  def determine_geofence_status
    return unless distance_from_site && job

    radius = job.site_radius_meters || 100
    self.within_geofence = distance_from_site <= radius
  end

  # Get coordinates as array [lat, lng]
  def coordinates
    [latitude, longitude]
  end

  # Get coordinates as hash
  def coordinates_hash
    { lat: latitude, lng: longitude }
  end

  private

  # Haversine formula for distance between two GPS points
  # Returns distance in meters
  def haversine_distance(lat1, lon1, lat2, lon2)
    earth_radius = 6_371_000 # meters

    lat1_rad = lat1 * Math::PI / 180
    lat2_rad = lat2 * Math::PI / 180
    delta_lat = (lat2 - lat1) * Math::PI / 180
    delta_lon = (lon2 - lon1) * Math::PI / 180

    a = Math.sin(delta_lat / 2)**2 +
        Math.cos(lat1_rad) * Math.cos(lat2_rad) * Math.sin(delta_lon / 2)**2

    c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    (earth_radius * c).round
  end

  def broadcast_location_update
    LocationChannel.broadcast_location(worker_profile, self) if defined?(LocationChannel)
  end

  def check_geofence_breach
    return if within_geofence

    GeofenceMonitorService.new.handle_breach(self) if defined?(GeofenceMonitorService)
  end
end
