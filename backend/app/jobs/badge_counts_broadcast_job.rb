# frozen_string_literal: true

# BadgeCountsBroadcastJob - Broadcasts badge counts to all connected WebSocket users
#
# Runs every 30 seconds via SolidQueue (recurring.yml).
# For each user with an active BadgeCountsChannel subscription,
# computes badge counts and pushes via WebSocket.
#
# FRC (Feb 2026): Replaces 7 HTTP polling endpoints that caused R14 memory
# on Basic web dyno. This runs on the shared worker (1024MB headroom),
# keeping the web dyno free from count query allocations.
#
# Memory-safe: Only runs COUNT queries (no full AR objects loaded).
# Each user's counts are computed independently so one failure doesn't
# block others.
#
class BadgeCountsBroadcastJob < ApplicationJob
  queue_as :default

  def perform
    # Get all users who have active WebSocket subscriptions to BadgeCountsChannel
    # ActionCable tracks subscriptions in Redis pubsub channels
    connected_user_ids = find_connected_user_ids
    return if connected_user_ids.empty?

    Rails.logger.debug "[BadgeCountsBroadcast] Broadcasting to #{connected_user_ids.size} users"

    connected_user_ids.each do |user_id|
      user = User.find_by(id: user_id)
      next unless user

      BadgeCountsChannel.broadcast_counts(user)
    rescue StandardError => e
      Rails.logger.error "[BadgeCountsBroadcast] Error for user #{user_id}: #{e.message}"
    end
  end

  private

  # Find user IDs likely to have active WebSocket subscriptions
  #
  # ⚠️ DO NOT SIMPLIFY - PostgreSQL adapter has no subscriber introspection (Feb 2026)
  # ════════════════════════════════════════════════════════════════════
  # Why: ActionCable with PostgreSQL adapter uses LISTEN/NOTIFY, not Redis pubsub.
  # There's no API to ask "who is currently subscribed to a channel?"
  # ❌ WRONG: redis_connection_for_subscriptions (Redis-only, crashes on PostgreSQL)
  # ❌ WRONG: last_sign_in_at (column doesn't exist - it's last_login_at)
  # ✅ CORRECT: Query recently active users. broadcast_to is a no-op for non-subscribers.
  # ════════════════════════════════════════════════════════════════════
  def find_connected_user_ids
    User.where("last_login_at > ?", 1.hour.ago).pluck(:id)
  end
end
