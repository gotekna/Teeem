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

  # Find user IDs with active BadgeCountsChannel subscriptions
  # ActionCable uses Redis pubsub - channel names follow the pattern:
  #   "action_cable/BadgeCountsChannel/Z:gid://teeem/User/123"
  def find_connected_user_ids
    redis = ActionCable.server.pubsub.send(:redis_connection_for_subscriptions)

    # Get all ActionCable subscription channels from Redis
    channels = redis.pubsub("channels", "action_cable/BadgeCountsChannel/*")

    # Extract user IDs from channel names
    # Channel format: "action_cable/BadgeCountsChannel/Z:gid://app-name/User/123"
    channels.filter_map do |channel|
      if channel =~ %r{/User/(\d+)\z}
        $1.to_i
      end
    end.uniq
  rescue StandardError => e
    # Fallback: broadcast to all recently active users if Redis introspection fails
    Rails.logger.warn "[BadgeCountsBroadcast] Redis channel lookup failed: #{e.message}, falling back to recent users"
    User.where("last_sign_in_at > ?", 1.hour.ago).pluck(:id)
  end
end
