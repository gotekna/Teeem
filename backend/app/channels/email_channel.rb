# frozen_string_literal: true

# EmailChannel - Real-time email updates via WebSocket
#
# Broadcasts email events to subscribed users:
# - new_email: When a new email is synced
# - email_state_changed: When user state changes (read, starred, pinned, etc.)
# - email_deleted: When an email is deleted
#
# Usage from frontend:
#   const cable = createConsumer(WS_URL);
#   cable.subscriptions.create("EmailChannel", {
#     received(data) { ... }
#   });
#
# Usage from backend:
#   EmailChannel.broadcast_new_email(user, email)
#   EmailChannel.broadcast_state_change(user, email_id, changes)
#
class EmailChannel < ApplicationCable::Channel
  def subscribed
    stream_for current_user
  end

  def unsubscribed
    # Cleanup when user disconnects
  end

  # Broadcast a new email to a user
  def self.broadcast_new_email(user, email_warehouse)
    return unless user && email_warehouse

    broadcast_to(user, {
      type: "new_email",
      email: serialize_email(email_warehouse)
    })
  end

  # Broadcast multiple new emails (batch sync)
  def self.broadcast_new_emails(user, email_warehouses)
    return unless user && email_warehouses.any?

    broadcast_to(user, {
      type: "new_emails",
      emails: email_warehouses.map { |e| serialize_email(e) },
      count: email_warehouses.size
    })
  end

  # Broadcast state change for an email
  def self.broadcast_state_change(user, email_id, changes)
    return unless user && email_id

    broadcast_to(user, {
      type: "email_state_changed",
      email_id: email_id,
      changes: changes
    })
  end

  # Broadcast email deleted
  def self.broadcast_email_deleted(user, email_id)
    return unless user && email_id

    broadcast_to(user, {
      type: "email_deleted",
      email_id: email_id
    })
  end

  # Broadcast sync started (for UI feedback)
  def self.broadcast_sync_started(user, sync_type: "incremental")
    return unless user

    broadcast_to(user, {
      type: "sync_started",
      sync_type: sync_type,
      started_at: Time.current.iso8601
    })
  end

  # Broadcast sync completed
  def self.broadcast_sync_completed(user, stats = {})
    return unless user

    broadcast_to(user, {
      type: "sync_completed",
      stats: {
        new_count: stats[:new_count] || 0,
        updated_count: stats[:updated_count] || 0,
        duration_seconds: stats[:duration_seconds] || 0
      },
      completed_at: Time.current.iso8601
    })
  end

  private

  def self.serialize_email(email)
    {
      id: email.id,
      internet_message_id: email.internet_message_id,
      subject: email.subject,
      from_email: email.from_email,
      from_name: email.from_name,
      to_emails: email.to_emails,
      received_at: email.received_at&.iso8601,
      snippet: email.snippet,
      body_preview: email.body_preview,
      has_attachments: email.has_attachments,
      attachment_count: email.attachment_count,
      conversation_id: email.conversation_id,
      is_latest_in_thread: email.is_latest_in_thread
    }
  end
end
