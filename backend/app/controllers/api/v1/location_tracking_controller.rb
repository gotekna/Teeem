# frozen_string_literal: true

# LocationTrackingController - Live location tracking endpoints for mobile app
#
# Part of Live Location Tracking System
# Handles:
# - Periodic location pings from mobile devices
# - Batch sync for offline pings
# - Path/route history retrieval
# - Active worker locations for dashboard
#
class Api::V1::LocationTrackingController < ApplicationController
  before_action :set_worker_profile, only: [:ping, :batch_ping]
  before_action :set_active_session, only: [:ping, :batch_ping]

  # POST /api/v1/location_tracking/ping
  # Receive single location update from mobile device
  def ping
    unless @active_session
      return render json: { success: false, error: "No active session" }, status: :unprocessable_entity
    end

    location_ping = @active_session.location_pings.build(ping_params)
    location_ping.worker_profile = @worker_profile
    location_ping.job = @active_session.job

    if location_ping.save
      render json: {
        success: true,
        data: {
          id: location_ping.id,
          within_geofence: location_ping.within_geofence,
          distance_from_site: location_ping.distance_from_site
        }
      }
    else
      render json: { success: false, errors: location_ping.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # POST /api/v1/location_tracking/batch_ping
  # Receive batch of location updates (for offline sync)
  def batch_ping
    unless @active_session
      return render json: { success: false, error: "No active session" }, status: :unprocessable_entity
    end

    pings = params[:pings] || []
    created_count = 0
    errors = []

    pings.each_with_index do |ping_data, index|
      location_ping = @active_session.location_pings.build(
        latitude: ping_data[:latitude],
        longitude: ping_data[:longitude],
        accuracy: ping_data[:accuracy],
        altitude: ping_data[:altitude],
        speed: ping_data[:speed],
        heading: ping_data[:heading],
        source: ping_data[:source] || "background",
        battery_level: ping_data[:battery_level],
        battery_state: ping_data[:battery_state],
        recorded_at: ping_data[:recorded_at] || Time.current
      )
      location_ping.worker_profile = @worker_profile
      location_ping.job = @active_session.job

      if location_ping.save
        created_count += 1
      else
        errors << { index: index, errors: location_ping.errors.full_messages }
      end
    end

    render json: {
      success: errors.empty?,
      data: {
        created: created_count,
        total: pings.count,
        errors: errors
      }
    }
  end

  # GET /api/v1/location_tracking/session/:id/path
  # Get location history/path for a session
  def session_path
    session = SitePresenceSession.find(params[:id])

    # Authorization: only session owner, supervisors, or admins
    unless can_view_session?(session)
      return render json: { success: false, error: "Unauthorized" }, status: :forbidden
    end

    pings = session.location_pings.chronological

    render json: {
      success: true,
      data: {
        session_id: session.id,
        worker_name: session.worker_profile.display_name,
        job_name: session.job.name,
        job_address: session.job.site_address,
        checkin_at: session.checkin_at&.iso8601,
        checkout_at: session.checkout_at&.iso8601,
        job_site: {
          latitude: session.job.site_latitude.to_f,
          longitude: session.job.site_longitude.to_f,
          radius_meters: session.job.site_radius_meters || 100
        },
        # Format for Leaflet Polyline: array of {latitude, longitude, recorded_at}
        points: pings.map do |p|
          {
            latitude: p.latitude.to_f,
            longitude: p.longitude.to_f,
            recorded_at: p.recorded_at.iso8601
          }
        end,
        geofence_events: session.geofence_events.map { |e| geofence_event_json(e) },
        stats: path_stats(pings, session.job)
      }
    }
  end

  # GET /api/v1/location_tracking/active
  # Get all currently active workers with their latest locations
  def active
    # Only supervisors and admins can view live locations
    # SSoT: Use has_role? (user.role column was removed, roles are now in user_roles table)
    unless current_user&.admin? || current_user&.has_role?('supervisor') || current_user&.has_role?('manager')
      return render json: { success: false, error: "Unauthorized" }, status: :forbidden
    end

    active_sessions = SitePresenceSession.active.includes(:worker_profile, :job, :location_pings)

    # Filter by job if specified
    active_sessions = active_sessions.where(job_id: params[:job_id]) if params[:job_id].present?

    # Collect unique job sites from active sessions
    job_sites = {}

    workers = active_sessions.map do |session|
      latest_ping = session.location_pings.recent.first
      job = session.job

      # Collect job site data for the map
      if job.site_latitude.present? && job.site_longitude.present? && !job_sites.key?(job.id)
        job_sites[job.id] = {
          id: job.id,
          name: job.name,
          latitude: job.site_latitude.to_f,
          longitude: job.site_longitude.to_f,
          radius_meters: job.site_radius_meters || 100
        }
      end

      # Use checkin location if no pings yet
      lat = latest_ping&.latitude || session.latitude_checkin
      lng = latest_ping&.longitude || session.longitude_checkin

      {
        worker_id: session.worker_profile_id,
        worker_name: session.worker_profile.display_name,
        session_id: session.id,
        job_id: session.job_id,
        job_name: job.name,
        latitude: lat.to_f,
        longitude: lng.to_f,
        within_geofence: latest_ping&.within_geofence != false,
        distance_from_site: latest_ping&.distance_from_site,
        checkin_at: session.checkin_at&.iso8601,
        last_ping_at: latest_ping&.recorded_at&.iso8601 || session.checkin_at&.iso8601
      }
    end

    render json: {
      success: true,
      data: {
        workers: workers,
        job_sites: job_sites.values,
        count: workers.count,
        timestamp: Time.current.iso8601
      }
    }
  end

  # GET /api/v1/location_tracking/geofence_events
  # Get recent geofence events (for alerts dashboard)
  def geofence_events
    # SSoT: Use has_role? (user.role column was removed, roles are now in user_roles table)
    unless current_user&.admin? || current_user&.has_role?('supervisor') || current_user&.has_role?('manager')
      return render json: { success: false, error: "Unauthorized" }, status: :forbidden
    end

    events = GeofenceEvent.recent
                          .includes(:worker_profile, :job, :site_presence_session)
                          .limit(params[:limit] || 50)

    # Filter by job if specified
    events = events.for_job(params[:job_id]) if params[:job_id].present?

    # Filter to today only by default
    events = events.today unless params[:all_time] == "true"

    render json: {
      success: true,
      data: {
        events: events.map { |e| geofence_event_json(e) },
        unacknowledged_count: events.unacknowledged.count
      }
    }
  end

  private

  def set_worker_profile
    @worker_profile = WorkerProfile.find_by(user_id: current_user&.id)
  end

  def set_active_session
    return unless @worker_profile

    @active_session = @worker_profile.site_presence_sessions.active.first
  end

  def ping_params
    params.permit(
      :latitude, :longitude, :accuracy, :altitude, :speed, :heading,
      :source, :battery_level, :battery_state, :recorded_at
    )
  end

  def can_view_session?(session)
    return true if current_user&.admin?
    # SSoT: Use has_role? (user.role column was removed, roles are now in user_roles table)
    return true if current_user&.has_role?('supervisor') || current_user&.has_role?('manager')
    return true if session.worker_profile.user_id == current_user&.id

    false
  end

  def path_point(ping)
    {
      lat: ping.latitude.to_f,
      lng: ping.longitude.to_f,
      time: ping.recorded_at.iso8601,
      within_geofence: ping.within_geofence,
      distance: ping.distance_from_site
    }
  end

  def geofence_event_json(event)
    {
      id: event.id,
      type: event.event_type,
      worker_id: event.worker_profile_id,
      worker_name: event.worker_profile.display_name,
      job_id: event.job_id,
      job_name: event.job.name,
      latitude: event.latitude,
      longitude: event.longitude,
      distance_from_site: event.distance_from_site,
      detected_at: event.detected_at.iso8601,
      resolved_at: event.resolved_at&.iso8601,
      duration: event.duration_display,
      acknowledged: event.acknowledged
    }
  end

  def path_stats(pings, job)
    return {} if pings.empty?

    inside_pings = pings.within_geofence.count
    outside_pings = pings.outside_geofence.count

    {
      total_pings: pings.count,
      pings_inside_geofence: inside_pings,
      pings_outside_geofence: outside_pings,
      time_on_site_percent: (inside_pings.to_f / pings.count * 100).round(1),
      max_distance_meters: pings.maximum(:distance_from_site),
      avg_distance_meters: pings.average(:distance_from_site)&.round(0)
    }
  end
end
