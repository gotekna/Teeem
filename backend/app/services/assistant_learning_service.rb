# frozen_string_literal: true

# AssistantLearningService - User preference learning (Phase 5)
#
# Learns user preferences over time to make the assistant smarter:
#   - Response tone (formal vs casual)
#   - Task naming patterns
#   - Priority thresholds (what they consider "urgent")
#   - Common contacts and jobs they work with
#   - Preferred channels for different types of alerts
#   - Time patterns (when they're most active)
#
# Data is stored in user.assistant_preferences JSONB field.
# All learning is transparent - user can see and reset preferences.
#
# Usage:
#   service = AssistantLearningService.new(user: current_user)
#   service.record_interaction(type: "task_created", data: { name: "Chase plumber" })
#   service.record_feedback(action_id: 123, approved: true)
#   context = service.personalized_context
#
class AssistantLearningService
  MAX_FREQUENT_ITEMS = 20
  LEARNING_WINDOW_DAYS = 90

  def initialize(user:)
    @user = user
    @prefs = (user.respond_to?(:assistant_preferences) ? user.assistant_preferences : nil) || {}
  end

  # Record an interaction for learning
  #
  # @param type [String] Interaction type
  # @param data [Hash] Interaction data
  def record_interaction(type:, data: {})
    case type
    when "task_created"
      learn_task_patterns(data)
    when "email_drafted"
      learn_email_patterns(data)
    when "search_performed"
      learn_search_patterns(data)
    when "channel_used"
      learn_channel_preference(data)
    when "active_time"
      learn_activity_patterns
    end

    save_preferences!
  rescue StandardError => e
    Rails.logger.error "[AssistantLearning] Error: #{e.message}"
  end

  # Record approval/rejection feedback for an action
  #
  # @param action_id [Integer] AssistantAction ID
  # @param approved [Boolean] Whether the action was approved
  def record_feedback(action_id:, approved:)
    action = AssistantAction.find_by(id: action_id, user: @user)
    return unless action

    feedback = @prefs["feedback_history"] || []
    feedback << {
      action_type: action.action_type,
      approved: approved,
      timestamp: Time.current.iso8601
    }

    # Keep last 100 feedback entries
    @prefs["feedback_history"] = feedback.last(100)

    # Update approval rates by action type
    rates = @prefs["approval_rates"] || {}
    type_feedback = feedback.select { |f| f["action_type"] == action.action_type }
    if type_feedback.size >= 5
      rates[action.action_type] = {
        total: type_feedback.size,
        approved: type_feedback.count { |f| f["approved"] },
        rate: (type_feedback.count { |f| f["approved"] }.to_f / type_feedback.size * 100).round(1)
      }
    end
    @prefs["approval_rates"] = rates

    # Check if we should suggest autopilot for any action type
    check_autopilot_suggestions

    save_preferences!
  end

  # Generate personalized context to inject into the assistant's system prompt
  #
  # @return [String] Context string for the system prompt
  def personalized_context
    parts = []

    # Frequent contacts
    frequent = @prefs["frequent_contacts"]
    if frequent.present? && frequent.any?
      names = frequent.first(5).map { |c| c["name"] }
      parts << "Frequently mentioned contacts: #{names.join(', ')}"
    end

    # Frequent jobs
    jobs = @prefs["frequent_jobs"]
    if jobs.present? && jobs.any?
      job_names = jobs.first(5).map { |j| j["name"] }
      parts << "Active jobs: #{job_names.join(', ')}"
    end

    # Tone preference
    tone = @prefs["tone_preference"]
    parts << "User prefers #{tone} communication style" if tone.present?

    # Activity patterns
    active_hours = @prefs["active_hours"]
    if active_hours.present?
      peak = active_hours.max_by { |_h, c| c }&.first
      parts << "Most active around #{peak}:00" if peak
    end

    # Action approval patterns
    rates = @prefs["approval_rates"]
    if rates.present?
      low_approval = rates.select { |_type, data| data["rate"].to_f < 50 }
      if low_approval.any?
        types = low_approval.keys.join(", ")
        parts << "Note: User often rejects #{types} actions - be more careful with these"
      end
    end

    parts.any? ? "\nUser preferences (learned over time):\n#{parts.join("\n")}" : ""
  end

  # Get current preferences (for user to review)
  def current_preferences
    {
      frequent_contacts: @prefs["frequent_contacts"]&.first(10) || [],
      frequent_jobs: @prefs["frequent_jobs"]&.first(10) || [],
      tone_preference: @prefs["tone_preference"],
      active_hours: @prefs["active_hours"],
      approval_rates: @prefs["approval_rates"],
      notification_channels: @prefs["notification_channels"] || ["web"],
      quiet_hours: @prefs["quiet_hours"],
      autopilot_enabled: @prefs["autopilot_enabled"] || false,
      autopilot_actions: @prefs["autopilot_actions"] || []
    }
  end

  # Reset all learned preferences
  def reset!
    @prefs = {
      "notification_channels" => @prefs["notification_channels"] || ["web"],
      "quiet_hours" => @prefs["quiet_hours"],
      "autopilot_enabled" => false,
      "autopilot_actions" => []
    }
    save_preferences!
  end

  private

  def check_autopilot_suggestions
    rates = @prefs["approval_rates"] || {}
    already_enabled = @prefs["autopilot_actions"] || []
    already_suggested = @prefs["autopilot_suggestions_sent"] || []

    rates.each do |action_type, data|
      next if already_enabled.include?(action_type)
      next if already_suggested.include?(action_type)
      next unless data["total"].to_i >= 10 && data["rate"].to_f >= 90.0

      # Create an alert suggesting autopilot for this action type
      AssistantAlert.create!(
        user: @user,
        tenant_id: @user.tenant_id,
        alert_type: "autopilot_suggestion",
        priority: "low",
        title: "Enable autopilot for '#{action_type.humanize}'?",
        summary: "You've approved #{data['approved']}/#{data['total']} #{action_type.humanize.downcase} actions (#{data['rate']}%). Enable autopilot to skip the approval step.",
        context_data: { action_type: action_type, approval_rate: data["rate"], total_actions: data["total"] },
        suggested_action_data: {
          action: "enable_autopilot",
          action_type: action_type,
          message: "Enable autopilot for #{action_type.humanize.downcase}"
        }
      )

      already_suggested << action_type
    rescue StandardError => e
      Rails.logger.error "[AssistantLearning] Autopilot suggestion failed: #{e.message}"
    end

    @prefs["autopilot_suggestions_sent"] = already_suggested
  end

  def learn_task_patterns(data)
    # Track common task name patterns
    if data[:name].present?
      patterns = @prefs["task_name_patterns"] || []
      # Extract action verbs
      verb = data[:name].split.first&.downcase
      patterns << verb if verb
      @prefs["task_name_patterns"] = patterns.tally.sort_by { |_k, v| -v }.first(20).map(&:first)
    end

    # Track frequently assigned jobs
    if data[:job_name].present?
      increment_frequent("frequent_jobs", { "name" => data[:job_name], "id" => data[:job_id] })
    end
  end

  def learn_email_patterns(data)
    # Track frequently emailed contacts
    if data[:to_name].present?
      increment_frequent("frequent_contacts", { "name" => data[:to_name], "email" => data[:to_email] })
    end
  end

  def learn_search_patterns(data)
    # Track common search terms
    if data[:query].present?
      queries = @prefs["common_searches"] || []
      queries << data[:query].downcase
      @prefs["common_searches"] = queries.tally.sort_by { |_k, v| -v }.first(20).map(&:first)
    end
  end

  def learn_channel_preference(data)
    channel = data[:channel]
    return unless channel.present?

    usage = @prefs["channel_usage"] || {}
    usage[channel] = (usage[channel] || 0) + 1
    @prefs["channel_usage"] = usage
  end

  def learn_activity_patterns
    hour = Time.current.in_time_zone("Australia/Brisbane").hour
    hours = @prefs["active_hours"] || {}
    hours[hour.to_s] = (hours[hour.to_s] || 0) + 1
    @prefs["active_hours"] = hours
  end

  def increment_frequent(key, item)
    items = @prefs[key] || []
    existing = items.find { |i| i["name"] == item["name"] }

    if existing
      existing["count"] = (existing["count"] || 1) + 1
    else
      item["count"] = 1
      items << item
    end

    @prefs[key] = items.sort_by { |i| -(i["count"] || 0) }.first(MAX_FREQUENT_ITEMS)
  end

  def save_preferences!
    return unless @user.respond_to?(:assistant_preferences=)

    @user.update_column(:assistant_preferences, @prefs)
  rescue StandardError => e
    Rails.logger.error "[AssistantLearning] Save failed: #{e.message}"
  end
end
