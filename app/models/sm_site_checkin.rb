# frozen_string_literal: true

# SmSiteCheckin - GPS-based site arrival/departure tracking
#
# Tracks when resources arrive at and leave construction sites.
# Used for:
# - Time tracking verification
# - Site attendance records
# - Travel time calculation
# - Safety accountability
#
class SmSiteCheckin < ApplicationRecord
  belongs_to :construction
  belongs_to :resource, class_name: 'SmResource'
  belongs_to :user, optional: true
  belongs_to :task, class_name: 'SmTask', foreign_key: 'sm_task_id', optional: true

  # Check-in types
  CHECKIN_TYPES = %w[arrival departure break_start break_end].freeze

  validates :checkin_type, presence: true, inclusion: { in: CHECKIN_TYPES }
  validates :latitude, presence: true, numericality: { greater_than_or_equal_to: -90, less_than_or_equal_to: 90 }
  validates :longitude, presence: true, numericality: { greater_than_or_equal_to: -180, less_than_or_equal_to: 180 }

  # Scopes
  scope :arrivals, -> { where(checkin_type: 'arrival') }
  scope :departures, -> { where(checkin_type: 'departure') }
  scope :for_date, ->(date) { where(checked_in_at: date.beginning_of_day..date.end_of_day) }
  scope :for_resource, ->(resource_id) { where(resource_id: resource_id) }
  scope :recent, -> { order(checked_in_at: :desc) }
  scope :today, -> { for_date(Date.current) }

  # Callbacks
  before_create :set_checked_in_at
  after_create :calculate_distance_from_site

  # Class methods
  def self.check_in(resource:, construction:, latitude:, longitude:, checkin_type: 'arrival', user: nil, task: nil)
    create!(
      resource: resource,
      construction: construction,
      latitude: latitude,
      longitude: longitude,
      checkin_type: checkin_type,
      user: user,
      task: task,
      device_info: detect_device_info
    )
  end

  def self.detect_device_info
    # Would be populated from request headers in controller
    nil
  end

  # Instance methods
  def on_site?
    distance_from_site.nil? || distance_from_site <= (allowed_radius || 100)
  end

  def allowed_radius
    # Default 100 meters, can be configured per construction
    construction&.site_radius_meters || 100
  end

  def duration_on_site
    return nil unless checkin_type == 'arrival'

    # Find matching departure
    departure = SmSiteCheckin.where(
      resource_id: resource_id,
      construction_id: construction_id,
      checkin_type: 'departure'
    ).where('checked_in_at > ?', checked_in_at).order(:checked_in_at).first

    return nil unless departure

    ((departure.checked_in_at - checked_in_at) / 1.hour).round(2)
  end

  def coordinates
    { latitude: latitude, longitude: longitude }
  end

  private

  def set_checked_in_at
    self.checked_in_at ||= Time.current
  end

  def calculate_distance_from_site
    return unless construction&.site_latitude && construction&.site_longitude

    # Haversine formula for distance calculation
    self.distance_from_site = haversine_distance(
      latitude, longitude,
      construction.site_latitude, construction.site_longitude
    )
    save!
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
