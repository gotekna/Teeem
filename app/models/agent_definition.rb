# frozen_string_literal: true

class AgentDefinition < ApplicationRecord
  # Associations
  belongs_to :created_by, class_name: 'User', optional: true
  belongs_to :updated_by, class_name: 'User', optional: true
  belongs_to :last_run_by, class_name: 'User', optional: true

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
  # @param user [User, nil] User who ran the agent
  def record_success(message, details = {}, user: nil)
    update!(
      total_runs: total_runs + 1,
      successful_runs: successful_runs + 1,
      last_run_at: Time.current,
      last_status: 'success',
      last_message: message,
      last_run_details: details,
      last_run_by_id: user&.id
    )
  end

  # Record a failed run
  # @param message [String] Failure message
  # @param details [Hash] Additional run details
  # @param user [User, nil] User who ran the agent
  def record_failure(message, details = {}, user: nil)
    update!(
      total_runs: total_runs + 1,
      failed_runs: failed_runs + 1,
      last_run_at: Time.current,
      last_status: 'failure',
      last_message: message,
      last_run_details: details,
      last_run_by_id: user&.id
    )
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
    when 'success' then '✅'
    when 'failure' then '❌'
    when 'error' then '⚠️'
    else '⚡'
    end
  end
end
