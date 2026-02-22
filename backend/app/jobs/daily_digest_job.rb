# frozen_string_literal: true

# DailyDigestJob - Morning briefing delivery
#
# Runs daily at 6:30am Australia/Brisbane via config/recurring.yml.
# Queue: :default (runs on teeem-shared-worker)
#
# For each active user:
# 1. Generates personalized briefing via DailyDigestService
# 2. Creates web alert (always)
# 3. Sends to preferred channels via AssistantNotificationRouter
#
# Skips if nothing to report. Only runs for active users
# (assistant conversation in last 30 days or any assistant alert in last 7 days).
#
# Cost: $0/month (pure SQL aggregation)
#
class DailyDigestJob < ApplicationJob
  queue_as :default

  def perform
    Rails.logger.info "[DailyDigest] Starting morning briefing generation"

    stats = { sent: 0, skipped: 0, errors: 0 }

    active_users.find_each do |user|
      ActsAsTenant.with_tenant(user.tenant) do
        deliver_digest(user, stats)
      end
    rescue StandardError => e
      Rails.logger.error "[DailyDigest] Error for user #{user.id}: #{e.message}"
      stats[:errors] += 1
    end

    Rails.logger.info "[DailyDigest] Complete: #{stats.inspect}"
  end

  private

  def active_users
    # Users who've used the assistant OR have active alerts recently
    User.where(id:
      User.joins(:assistant_conversations)
        .where("assistant_conversations.last_message_at > ?", 30.days.ago)
        .select(:id)
        .union(
          User.joins("INNER JOIN assistant_alerts ON assistant_alerts.user_id = users.id")
            .where("assistant_alerts.created_at > ?", 7.days.ago)
            .select("users.id")
        )
    ).distinct
  end

  def deliver_digest(user, stats)
    # Check if user has digest enabled (default: true for active users)
    prefs = user.respond_to?(:assistant_preferences) ? (user.assistant_preferences || {}) : {}
    unless prefs.fetch("daily_digest_enabled", true)
      stats[:skipped] += 1
      return
    end

    service = DailyDigestService.new(user: user)
    digest = service.generate

    unless digest[:has_items]
      stats[:skipped] += 1
      return
    end

    # Create web alert with digest summary
    section_summaries = digest[:sections].map { |s| "#{s[:count]} #{s[:title].downcase}" }
    alert = AssistantAlert.create!(
      user: user,
      tenant_id: user.tenant_id,
      alert_type: "daily_digest",
      priority: digest[:sections].any? { |s| s[:type] == "overdue" } ? "medium" : "low",
      title: "Daily Briefing - #{digest[:generated_at]}",
      summary: section_summaries.join(", "),
      context_data: digest,
      suggested_action_data: {
        action: "daily_briefing",
        message: "Give me my daily briefing"
      }
    )

    # Route to preferred channels
    router = AssistantNotificationRouter.new(user: user)
    router.route_alert(alert)

    stats[:sent] += 1
  end
end
