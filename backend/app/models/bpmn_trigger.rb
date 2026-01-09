class BpmnTrigger < ApplicationRecord
  # Associations
  belongs_to :bpmn_process

  # Constants
  TRIGGER_TYPES = %w[manual status_change scheduled field_change webhook].freeze

  # Validations
  validates :trigger_type, inclusion: { in: TRIGGER_TYPES }
  validates :name, presence: true
  validate :validate_config

  # Scopes
  scope :active, -> { where(is_active: true) }
  scope :inactive, -> { where(is_active: false) }
  scope :manual, -> { where(trigger_type: "manual") }
  scope :status_change, -> { where(trigger_type: "status_change") }
  scope :scheduled, -> { where(trigger_type: "scheduled") }
  scope :field_change, -> { where(trigger_type: "field_change") }
  scope :webhook, -> { where(trigger_type: "webhook") }

  # Instance methods
  def manual?
    trigger_type == "manual"
  end

  def status_change?
    trigger_type == "status_change"
  end

  def scheduled?
    trigger_type == "scheduled"
  end

  def field_change?
    trigger_type == "field_change"
  end

  def webhook?
    trigger_type == "webhook"
  end

  def activate!
    update!(is_active: true)
  end

  def deactivate!
    update!(is_active: false)
  end

  # Config accessors
  def entity_type
    config&.dig("entity_type")
  end

  def entity_class
    entity_type&.constantize
  rescue NameError
    nil
  end

  def field_name
    config&.dig("field_name") || config&.dig("field")
  end

  def from_values
    Array(config&.dig("from_values") || config&.dig("from"))
  end

  def to_values
    Array(config&.dig("to_values") || config&.dig("to"))
  end

  def cron_expression
    config&.dig("cron")
  end

  def timezone
    config&.dig("timezone") || "Australia/Brisbane"
  end

  def webhook_secret
    config&.dig("secret")
  end

  # Check if trigger matches an event
  def matches_status_change?(entity, old_value, new_value)
    return false unless status_change? && is_active

    # Check entity type
    return false unless entity.class.name == entity_type

    # Check field matches
    return false if field_name.present? && entity.class.reflect_on_association(field_name.to_sym).nil? &&
                    !entity.respond_to?(field_name)

    # Check from values
    return false if from_values.present? && !from_values.include?(old_value)

    # Check to values
    return false if to_values.present? && !to_values.include?(new_value)

    true
  end

  def matches_field_change?(entity, changed_fields)
    return false unless field_change? && is_active
    return false unless entity.class.name == entity_type
    return false unless changed_fields.include?(field_name)

    true
  end

  # Display helpers
  def display_trigger_type
    trigger_type.humanize
  end

  def description
    case trigger_type
    when "manual"
      "Started manually by user"
    when "status_change"
      "When #{entity_type} #{field_name} changes#{to_values.present? ? " to #{to_values.join(', ')}" : ""}"
    when "scheduled"
      "Runs on schedule: #{cron_expression}"
    when "field_change"
      "When #{entity_type}.#{field_name} changes"
    when "webhook"
      "Triggered via webhook"
    else
      trigger_type.humanize
    end
  end

  private

  def validate_config
    case trigger_type
    when "status_change", "field_change"
      errors.add(:config, "entity_type is required") if entity_type.blank?
      errors.add(:config, "invalid entity_type") if entity_type.present? && entity_class.nil?
    when "scheduled"
      errors.add(:config, "cron expression is required") if cron_expression.blank?
    end
  end
end
