# frozen_string_literal: true

# GeofenceMonitorService - Monitors worker locations for geofence breaches
#
# Part of Live Location Tracking System
# Handles:
# - Detecting when workers exit job site geofence
# - Creating GeofenceEvent records
# - Resolving events when workers return
# - Triggering notifications for breaches
#
# Usage:
#   GeofenceMonitorService.new.handle_breach(location_ping)
#   GeofenceMonitorService.new.resolve_events_for_session(session)
#
class GeofenceMonitorService
  # Handle a potential geofence breach from a location ping
  def handle_breach(ping)
    return unless ping.job&.site_latitude && ping.job&.site_longitude
    return if ping.within_geofence

    session = ping.site_presence_session
    job = ping.job

    # Check if there's already an unresolved exit event for this session
    existing_event = GeofenceEvent.where(
      site_presence_session: session,
      event_type: "exit",
      resolved_at: nil
    ).first

    # If no existing event, create a new one
    unless existing_event
      create_exit_event(ping)
    end
  end

  # Resolve any open geofence events when worker returns to site
  def handle_return(ping)
    return unless ping.within_geofence

    session = ping.site_presence_session

    # Resolve any open exit events
    open_events = GeofenceEvent.where(
      site_presence_session: session,
      event_type: "exit",
      resolved_at: nil
    )

    open_events.each do |event|
      event.resolve!(ping.recorded_at)
      create_enter_event(ping, event)
    end
  end

  # Resolve all open events when a session ends
  def resolve_events_for_session(session, checkout_time = Time.current)
    open_events = GeofenceEvent.where(
      site_presence_session: session,
      resolved_at: nil
    )

    open_events.each do |event|
      event.resolve!(checkout_time)
    end
  end

  # Check a ping and handle both breach and return scenarios
  def check_ping(ping)
    if ping.within_geofence
      handle_return(ping)
    else
      handle_breach(ping)
    end
  end

  private

  def create_exit_event(ping)
    event = GeofenceEvent.create!(
      site_presence_session: ping.site_presence_session,
      worker_profile: ping.worker_profile,
      job: ping.job,
      event_type: "exit",
      latitude: ping.latitude,
      longitude: ping.longitude,
      distance_from_site: ping.distance_from_site,
      detected_at: ping.recorded_at
    )

    # Broadcast to ActionCable
    LocationChannel.broadcast_geofence_event(event)

    # Queue notification job
    GeofenceAlertJob.perform_later(event.id) if defined?(GeofenceAlertJob)

    event
  end

  def create_enter_event(ping, exit_event)
    event = GeofenceEvent.create!(
      site_presence_session: ping.site_presence_session,
      worker_profile: ping.worker_profile,
      job: ping.job,
      event_type: "enter",
      latitude: ping.latitude,
      longitude: ping.longitude,
      distance_from_site: ping.distance_from_site,
      detected_at: ping.recorded_at
    )

    # Broadcast to ActionCable
    LocationChannel.broadcast_geofence_event(event)

    event
  end
end
