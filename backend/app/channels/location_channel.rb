# frozen_string_literal: true

# LocationChannel - Real-time worker location updates via WebSocket
#
# Part of Live Location Tracking System
# Broadcasts events for:
# - location_update: Worker position changed
# - geofence_breach: Worker exited job site geofence
# - geofence_return: Worker re-entered geofence
# - worker_checkin: Worker started a session
# - worker_checkout: Worker ended a session
#
# Subscribed by dashboard when user opens live tracking page
# Only supervisors/managers/admins can subscribe
#
# Usage (from backend):
#   LocationChannel.broadcast_location(worker_profile, ping)
#   LocationChannel.broadcast_geofence_event(event)
#
class LocationChannel < ApplicationCable::Channel
  def subscribed
    # Only supervisors, managers, and admins can view live locations
    # SSoT: Use has_role? (user.role column was removed, roles are now in user_roles table)
    unless current_user&.admin? || current_user&.has_role?('supervisor') || current_user&.has_role?('manager')
      reject
      return
    end

    # Stream all location updates (organization-wide)
    stream_from "location_updates"
    Rails.logger.info "[LocationChannel] User #{current_user.id} subscribed to live locations"
  end

  def unsubscribed
    Rails.logger.info "[LocationChannel] User #{current_user&.id} unsubscribed from live locations"
  end

  # Broadcast a location update for a worker
  def self.broadcast_location(worker_profile, ping)
    ActionCable.server.broadcast("location_updates", {
      type: "location_update",
      worker_id: worker_profile.id,
      worker_name: worker_profile.display_name,
      session_id: ping.site_presence_session_id,
      job_id: ping.job_id,
      latitude: ping.latitude.to_f,
      longitude: ping.longitude.to_f,
      accuracy: ping.accuracy,
      within_geofence: ping.within_geofence,
      distance_from_site: ping.distance_from_site,
      recorded_at: ping.recorded_at.iso8601,
      timestamp: Time.current.iso8601
    })
  end

  # Broadcast a geofence event
  def self.broadcast_geofence_event(event)
    ActionCable.server.broadcast("location_updates", {
      type: "geofence_#{event.event_type}",  # geofence_exit or geofence_enter
      event_id: event.id,
      worker_id: event.worker_profile_id,
      worker_name: event.worker_profile.display_name,
      session_id: event.site_presence_session_id,
      job_id: event.job_id,
      job_name: event.job.name,
      latitude: event.latitude,
      longitude: event.longitude,
      distance_from_site: event.distance_from_site,
      detected_at: event.detected_at.iso8601,
      timestamp: Time.current.iso8601
    })
  end

  # Broadcast when a worker checks in
  def self.broadcast_checkin(session)
    ActionCable.server.broadcast("location_updates", {
      type: "worker_checkin",
      session_id: session.id,
      worker_id: session.worker_profile_id,
      worker_name: session.worker_profile.display_name,
      job_id: session.job_id,
      job_name: session.job.name,
      checkin_at: session.checkin_at.iso8601,
      latitude: session.latitude_checkin,
      longitude: session.longitude_checkin,
      timestamp: Time.current.iso8601
    })
  end

  # Broadcast when a worker checks out
  def self.broadcast_checkout(session)
    ActionCable.server.broadcast("location_updates", {
      type: "worker_checkout",
      session_id: session.id,
      worker_id: session.worker_profile_id,
      worker_name: session.worker_profile.display_name,
      job_id: session.job_id,
      job_name: session.job.name,
      checkin_at: session.checkin_at.iso8601,
      checkout_at: session.checkout_at.iso8601,
      total_hours: session.total_hours,
      timestamp: Time.current.iso8601
    })
  end
end
