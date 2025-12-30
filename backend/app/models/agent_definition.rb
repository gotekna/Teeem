# frozen_string_literal: true

class AgentDefinition < ApplicationRecord
  # Associations
  belongs_to :created_by, class_name: "User", optional: true
  belongs_to :updated_by, class_name: "User", optional: true
  belongs_to :last_run_by, class_name: "User", optional: true

  # Validations
  validates :agent_id, presence: true, uniqueness: true
  validates :name, presence: true
  validates :agent_type, presence: true
  validates :focus, presence: true
  validates :model, presence: true

  # Scopes
  scope :active, -> { where(active: true) }
  scope :by_priority, -> { order(priority: :desc, name: :asc) }
  scope :by_type, ->(type) { where(agent_type: type) }

  # Agent types
  AGENT_TYPES = %w[development diagnostic deployment planning].freeze

  # Record a successful run
  # @param message [String] Success message
  # @param details [Hash] Additional run details
  # @param user_name [String, nil] Name of user who ran the agent (from git config)
  # @param tokens [Integer, nil] Tokens used in this run
  def record_success(message, details = {}, user_name: nil, tokens: nil)
    attrs = {
      total_runs: total_runs + 1,
      successful_runs: successful_runs + 1,
      last_run_at: Time.current,
      last_status: "success",
      last_message: message,
      last_run_details: details,
      last_run_by_name: user_name
    }
    if tokens.present?
      attrs[:last_run_tokens] = tokens
      attrs[:total_tokens] = (total_tokens || 0) + tokens
    end
    update!(attrs)
  end

  # Record a failed run
  # @param message [String] Failure message
  # @param details [Hash] Additional run details
  # @param user_name [String, nil] Name of user who ran the agent (from git config)
  # @param tokens [Integer, nil] Tokens used in this run
  def record_failure(message, details = {}, user_name: nil, tokens: nil)
    attrs = {
      total_runs: total_runs + 1,
      failed_runs: failed_runs + 1,
      last_run_at: Time.current,
      last_status: "failure",
      last_message: message,
      last_run_details: details,
      last_run_by_name: user_name
    }
    if tokens.present?
      attrs[:last_run_tokens] = tokens
      attrs[:total_tokens] = (total_tokens || 0) + tokens
    end
    update!(attrs)
  end

  # Success rate
  def success_rate
    return 0 if total_runs.zero?

    (successful_runs.to_f / total_runs * 100).round(1)
  end

  # Has run recently?
  def recently_run?(minutes = 60)
    return false if last_run_at.nil?

    last_run_at > minutes.minutes.ago
  end

  # Last run status emoji
  def status_emoji
    case last_status
    when "success" then "✅"
    when "failure" then "❌"
    when "error" then "⚠️"
    else "⚡"
    end
  end

  # Health status for admin display
  # Returns: healthy, warning, broken, deprecated
  def health_status
    return "deprecated" unless active?
    return "broken" unless file_exists?
    return "warning" if stale?

    "healthy"
  end

  # Check if the agent's source file exists
  def file_exists?
    path = source_path
    return true if path.blank?

    project_root = Rails.root.parent
    full_path = project_root.join(path)
    File.exist?(full_path)
  end

  # Get source path from metadata
  def source_path
    metadata&.dig("source_path")
  end

  # Check if agent hasn't been run in 30+ days
  def stale?
    return true if last_run_at.nil? && total_runs.zero?

    last_run_at.present? && last_run_at < 30.days.ago
  end

  # Days since last run
  def days_since_last_run
    return nil if last_run_at.nil?

    ((Time.current - last_run_at) / 1.day).to_i
  end
end
