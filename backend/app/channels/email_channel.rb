# frozen_string_literal: true

# EmailChannel - Real-time email updates via WebSocket
#
# Subscribed by frontend when user opens email page
# Broadcasts events for:
# - new_email: Single new email synced
# - new_emails: Multiple emails synced (batch)
# - email_state_changed: Read/starred/pinned state changed
# - email_deleted: Email was deleted
# - sync_started: Sync process started
# - sync_completed: Sync process finished
#
# Usage (from backend):
#   EmailChannel.broadcast_new_email(user, email)
#   EmailChannel.broadcast_state_changed(user, email_id, changes)
#
class EmailChannel < ApplicationCable::Channel
  def subscribed
    # Stream for the current user only
    stream_for current_user
    Rails.logger.info "[EmailChannel] User #{current_user.id} subscribed"
  end

  def unsubscribed
    Rails.logger.info "[EmailChannel] User #{current_user.id} unsubscribed"
  end

  # Broadcast a new email to a user
  def self.broadcast_new_email(user, email)
    broadcast_to(user, {
      type: "new_email",
      email: email
    })
  end

  # Broadcast multiple new emails to a user
  def self.broadcast_new_emails(user, emails, count)
    broadcast_to(user, {
      type: "new_emails",
      emails: emails,
      count: count
    })
  end

  # Broadcast email state change to a user
  def self.broadcast_state_changed(user, email_id, changes)
    broadcast_to(user, {
      type: "email_state_changed",
      email_id: email_id,
      changes: changes
    })
  end

  # Broadcast email deletion to a user
  def self.broadcast_deleted(user, email_id)
    broadcast_to(user, {
      type: "email_deleted",
      email_id: email_id
    })
  end

  # Broadcast sync started to a user
  def self.broadcast_sync_started(user, sync_type: "incremental")
    broadcast_to(user, {
      type: "sync_started",
      sync_type: sync_type,
      started_at: Time.current.iso8601
    })
  end

  # Broadcast sync completed to a user
  def self.broadcast_sync_completed(user, new_count:, updated_count:, duration_seconds:)
    broadcast_to(user, {
      type: "sync_completed",
      stats: {
        new_count: new_count,
        updated_count: updated_count,
        duration_seconds: duration_seconds
      },
      completed_at: Time.current.iso8601
    })
  end
end
