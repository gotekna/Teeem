# frozen_string_literal: true

# AnomalyDetectionService - Detects timesheet and site presence anomalies
#
# Part of Site Presence & Cost Intelligence System
# See: .claude/plans/piped-orbiting-whisper.md
#
# Detects:
# - Excessive hours (>12h in one session)
# - Location mismatch (>500m from job site)
# - Unusual times (before 5am or after 10pm)
# - Face mismatch (verification failed)
# - Missing photos (required but not provided)
# - Duplicate sessions (overlapping times)
# - Pattern anomalies (unusual for this worker)
#
class AnomalyDetectionService
  attr_reader :anomalies

  # Thresholds
  EXCESSIVE_HOURS_THRESHOLD = 12
  LOCATION_MISMATCH_THRESHOLD = 500 # meters
  EARLY_START_HOUR = 5
  LATE_END_HOUR = 22

  # Severity levels
  SEVERITY_WARNING = "warning"
  SEVERITY_CRITICAL = "critical"

  # Anomaly types
  ANOMALY_TYPES = %w[
    excessive_hours
    location_mismatch
    unusual_time
    face_mismatch
    missing_photo
    duplicate_session
    pattern_anomaly
    gps_spoofing
    rapid_location_change
  ].freeze

  def initialize
    @anomalies = []
  end

  # Analyze a site presence session for anomalies
  def analyze_session(session)
    @anomalies = []

    check_excessive_hours(session)
    check_location_mismatch(session)
    check_unusual_times(session)
    check_face_verification(session)
    check_missing_photos(session)
    check_duplicate_sessions(session)
    check_gps_spoofing(session)
    check_rapid_location_change(session)

    # Update session with anomaly data
    if @anomalies.any?
      session.update!(
        has_anomalies: true,
        anomaly_details: build_anomaly_details
      )
    end

    {
      session_id: session.id,
      has_anomalies: @anomalies.any?,
      anomaly_count: @anomalies.count,
      critical_count: @anomalies.count { |a| a[:severity] == SEVERITY_CRITICAL },
      warning_count: @anomalies.count { |a| a[:severity] == SEVERITY_WARNING },
      anomalies: @anomalies
    }
  end

  # Analyze all sessions for a date
  def analyze_date(date:)
    sessions = SitePresenceSession.where("DATE(checkin_at) = ?", date)
    results = []

    sessions.find_each do |session|
      result = analyze_session(session)
      results << result if result[:has_anomalies]
    end

    {
      date: date,
      sessions_analyzed: sessions.count,
      sessions_with_anomalies: results.count,
      total_anomalies: results.sum { |r| r[:anomaly_count] },
      critical_anomalies: results.sum { |r| r[:critical_count] },
      results: results
    }
  end

  # Analyze worker patterns for unusual behavior
  def analyze_worker_patterns(worker_profile:, days: 30)
    @anomalies = []

    sessions = worker_profile.site_presence_sessions
                             .where("checkin_at > ?", days.days.ago)
                             .completed

    return { worker_id: worker_profile.id, message: "Not enough data" } if sessions.count < 5

    # Calculate averages
    avg_hours = sessions.average(:total_hours)&.to_f || 0
    avg_start = calculate_average_start_time(sessions)
    avg_end = calculate_average_end_time(sessions)

    # Find outliers
    pattern_anomalies = []

    sessions.each do |session|
      next unless session.total_hours

      # Hours outlier (>2 std dev from mean)
      if session.total_hours > avg_hours * 1.5
        pattern_anomalies << {
          session_id: session.id,
          type: "hours_outlier",
          expected: avg_hours.round(2),
          actual: session.total_hours.round(2),
          date: session.checkin_at.to_date
        }
      end

      # Unusual start time for this worker
      if session.checkin_at && avg_start
        start_hour = session.checkin_at.hour + (session.checkin_at.min / 60.0)
        if (start_hour - avg_start).abs > 2
          pattern_anomalies << {
            session_id: session.id,
            type: "start_time_outlier",
            expected: format_hour(avg_start),
            actual: session.checkin_at.strftime("%H:%M"),
            date: session.checkin_at.to_date
          }
        end
      end
    end

    {
      worker_id: worker_profile.id,
      worker_name: worker_profile.display_name,
      analysis_period: "#{days} days",
      sessions_analyzed: sessions.count,
      averages: {
        hours_per_day: avg_hours.round(2),
        typical_start: format_hour(avg_start),
        typical_end: format_hour(avg_end)
      },
      pattern_anomalies: pattern_anomalies
    }
  end

  # Get anomaly summary for dashboard
  def dashboard_summary(days: 7)
    start_date = days.days.ago.to_date

    sessions_with_anomalies = SitePresenceSession.where("checkin_at > ?", start_date)
                                                  .where(has_anomalies: true)

    by_type = {}
    ANOMALY_TYPES.each { |t| by_type[t] = 0 }

    sessions_with_anomalies.find_each do |session|
      next unless session.anomaly_details.is_a?(Hash)

      session.anomaly_details.each do |key, _value|
        type = key.to_s.gsub(/_checkin|_checkout/, "")
        by_type[type] = (by_type[type] || 0) + 1
      end
    end

    critical_sessions = sessions_with_anomalies.where(
      "anomaly_details::text LIKE '%critical%'"
    )

    {
      period: "Last #{days} days",
      total_sessions: SitePresenceSession.where("checkin_at > ?", start_date).count,
      sessions_with_anomalies: sessions_with_anomalies.count,
      anomaly_rate: calculate_rate(sessions_with_anomalies.count, SitePresenceSession.where("checkin_at > ?", start_date).count),
      critical_sessions: critical_sessions.count,
      by_type: by_type.reject { |_, v| v.zero? },
      recent_critical: critical_sessions.order(checkin_at: :desc).limit(5).map do |s|
        {
          id: s.id,
          worker: s.worker_profile&.display_name,
          job: s.job&.name,
          date: s.checkin_at&.to_date,
          anomalies: s.anomaly_details&.keys
        }
      end
    }
  end

  private

  def check_excessive_hours(session)
    return unless session.total_hours

    if session.total_hours > EXCESSIVE_HOURS_THRESHOLD
      add_anomaly(
        type: "excessive_hours",
        severity: SEVERITY_WARNING,
        message: "Session duration of #{session.total_hours.round(2)} hours exceeds #{EXCESSIVE_HOURS_THRESHOLD} hour threshold",
        data: { hours: session.total_hours, threshold: EXCESSIVE_HOURS_THRESHOLD }
      )
    end
  end

  def check_location_mismatch(session)
    # Check check-in location
    if session.distance_from_site_checkin && session.distance_from_site_checkin > LOCATION_MISMATCH_THRESHOLD
      add_anomaly(
        type: "location_mismatch",
        severity: SEVERITY_CRITICAL,
        message: "Check-in location #{session.distance_from_site_checkin.round(0)}m from job site (threshold: #{LOCATION_MISMATCH_THRESHOLD}m)",
        data: { distance: session.distance_from_site_checkin, threshold: LOCATION_MISMATCH_THRESHOLD, event: "checkin" }
      )
    end

    # Check check-out location
    if session.distance_from_site_checkout && session.distance_from_site_checkout > LOCATION_MISMATCH_THRESHOLD
      add_anomaly(
        type: "location_mismatch",
        severity: SEVERITY_CRITICAL,
        message: "Check-out location #{session.distance_from_site_checkout.round(0)}m from job site (threshold: #{LOCATION_MISMATCH_THRESHOLD}m)",
        data: { distance: session.distance_from_site_checkout, threshold: LOCATION_MISMATCH_THRESHOLD, event: "checkout" }
      )
    end
  end

  def check_unusual_times(session)
    if session.checkin_at
      hour = session.checkin_at.hour
      if hour < EARLY_START_HOUR
        add_anomaly(
          type: "unusual_time",
          severity: SEVERITY_WARNING,
          message: "Check-in at #{session.checkin_at.strftime('%H:%M')} is unusually early (before #{EARLY_START_HOUR}:00)",
          data: { time: session.checkin_at, event: "checkin", threshold: EARLY_START_HOUR }
        )
      end
    end

    if session.checkout_at
      hour = session.checkout_at.hour
      if hour >= LATE_END_HOUR
        add_anomaly(
          type: "unusual_time",
          severity: SEVERITY_WARNING,
          message: "Check-out at #{session.checkout_at.strftime('%H:%M')} is unusually late (after #{LATE_END_HOUR}:00)",
          data: { time: session.checkout_at, event: "checkout", threshold: LATE_END_HOUR }
        )
      end
    end
  end

  def check_face_verification(session)
    if session.checkin_photo_id.present? && session.face_verified_checkin == false
      confidence = session.face_confidence_checkin || 0
      add_anomaly(
        type: "face_mismatch",
        severity: SEVERITY_CRITICAL,
        message: "Face verification failed on check-in photo (confidence: #{confidence.round(1)}%)",
        data: { confidence: confidence, event: "checkin" }
      )
    end

    if session.checkout_photo_id.present? && session.face_verified_checkout == false
      confidence = session.face_confidence_checkout || 0
      add_anomaly(
        type: "face_mismatch",
        severity: SEVERITY_CRITICAL,
        message: "Face verification failed on check-out photo (confidence: #{confidence.round(1)}%)",
        data: { confidence: confidence, event: "checkout" }
      )
    end
  end

  def check_missing_photos(session)
    # Only flag if job requires photos
    return unless session.job&.site_presence_enabled

    if session.checkin_photo_id.blank?
      add_anomaly(
        type: "missing_photo",
        severity: SEVERITY_WARNING,
        message: "No check-in photo provided",
        data: { event: "checkin" }
      )
    end

    if session.completed? && session.checkout_photo_id.blank?
      add_anomaly(
        type: "missing_photo",
        severity: SEVERITY_WARNING,
        message: "No check-out photo provided",
        data: { event: "checkout" }
      )
    end
  end

  def check_duplicate_sessions(session)
    return unless session.checkin_at

    overlapping = SitePresenceSession.where(worker_profile_id: session.worker_profile_id)
                                     .where.not(id: session.id)
                                     .where("checkin_at <= ? AND (checkout_at IS NULL OR checkout_at >= ?)",
                                            session.checkout_at || Time.current,
                                            session.checkin_at)

    if overlapping.exists?
      add_anomaly(
        type: "duplicate_session",
        severity: SEVERITY_CRITICAL,
        message: "Session overlaps with #{overlapping.count} other session(s)",
        data: { overlapping_ids: overlapping.pluck(:id) }
      )
    end
  end

  def check_gps_spoofing(session)
    # Check for suspiciously precise GPS coordinates (sign of spoofing)
    [
      [session.latitude_checkin, session.longitude_checkin, "checkin"],
      [session.latitude_checkout, session.longitude_checkout, "checkout"]
    ].each do |lat, lng, event|
      next unless lat && lng

      # Check for round numbers (common in spoofing)
      lat_decimal = (lat % 1).abs
      lng_decimal = (lng % 1).abs

      if lat_decimal.zero? && lng_decimal.zero?
        add_anomaly(
          type: "gps_spoofing",
          severity: SEVERITY_CRITICAL,
          message: "GPS coordinates suspiciously precise at #{event} (possible spoofing)",
          data: { lat: lat, lng: lng, event: event }
        )
      end
    end
  end

  def check_rapid_location_change(session)
    return unless session.checkin_at && session.checkout_at
    return unless session.latitude_checkin && session.latitude_checkout

    # Calculate distance between check-in and check-out
    distance = haversine_distance(
      session.latitude_checkin, session.longitude_checkin,
      session.latitude_checkout, session.longitude_checkout
    )

    # Calculate time between
    hours = (session.checkout_at - session.checkin_at) / 1.hour

    return if hours <= 0 || distance <= 0

    # Calculate speed (km/h)
    speed = distance / hours

    # Flag if speed suggests impossible travel (>200 km/h without breaks)
    if speed > 200
      add_anomaly(
        type: "rapid_location_change",
        severity: SEVERITY_WARNING,
        message: "Location change of #{distance.round(1)}km in #{hours.round(2)} hours suggests data issue",
        data: { distance_km: distance.round(2), hours: hours.round(2), implied_speed_kmh: speed.round(0) }
      )
    end
  end

  def add_anomaly(type:, severity:, message:, data: {})
    @anomalies << {
      type: type,
      severity: severity,
      message: message,
      data: data,
      detected_at: Time.current
    }
  end

  def build_anomaly_details
    result = {}
    @anomalies.each do |anomaly|
      key = anomaly[:type]
      key += "_#{anomaly[:data][:event]}" if anomaly[:data][:event]
      result[key] = {
        severity: anomaly[:severity],
        message: anomaly[:message],
        data: anomaly[:data],
        detected_at: anomaly[:detected_at].iso8601
      }
    end
    result
  end

  def calculate_average_start_time(sessions)
    times = sessions.map { |s| s.checkin_at&.hour.to_f + (s.checkin_at&.min || 0) / 60.0 }.compact
    return nil if times.empty?

    times.sum / times.length
  end

  def calculate_average_end_time(sessions)
    times = sessions.map { |s| s.checkout_at&.hour.to_f + (s.checkout_at&.min || 0) / 60.0 }.compact
    return nil if times.empty?

    times.sum / times.length
  end

  def format_hour(decimal_hour)
    return nil unless decimal_hour

    hours = decimal_hour.floor
    minutes = ((decimal_hour - hours) * 60).round
    format("%02d:%02d", hours, minutes)
  end

  def calculate_rate(count, total)
    return 0 if total.zero?

    ((count.to_f / total) * 100).round(1)
  end

  def haversine_distance(lat1, lon1, lat2, lon2)
    # Earth's radius in kilometers
    r = 6371

    dlat = to_radians(lat2 - lat1)
    dlon = to_radians(lon2 - lon1)

    a = Math.sin(dlat / 2)**2 +
        Math.cos(to_radians(lat1)) * Math.cos(to_radians(lat2)) *
        Math.sin(dlon / 2)**2

    c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    r * c # Distance in km
  end

  def to_radians(degrees)
    degrees * Math::PI / 180
  end
end
