# frozen_string_literal: true

# == Schema Information
#
# Table name: takeoff_templates
#
#  id             :bigint           not null, primary key
#  tenant_id      :bigint           not null
#  created_by_id  :bigint
#  name           :string           not null
#  description    :string
#  category       :string
#  is_system      :boolean          default(FALSE)
#  is_active      :boolean          default(TRUE)
#  configuration  :jsonb            not null, default: {}
#  usage_count    :integer          default(0)
#  created_at     :datetime         not null
#  updated_at     :datetime         not null
#
# Indexes
#
#  index_takeoff_templates_on_tenant_id_and_name       (tenant_id,name) UNIQUE
#  index_takeoff_templates_on_tenant_id_and_category   (tenant_id,category)
#  index_takeoff_templates_on_tenant_id_and_is_active  (tenant_id,is_active)
#
class TakeoffTemplate < ApplicationRecord
  acts_as_tenant(:tenant)
  include ConfigSyncable

  belongs_to :tenant
  belongs_to :created_by, class_name: "User", optional: true

  # Validations
  validates :name, presence: true, uniqueness: { scope: :tenant_id }
  validates :configuration, presence: true
  validate :validate_configuration_structure

  # Scopes
  scope :active, -> { where(is_active: true) }
  scope :by_category, ->(category) { where(category: category) }
  scope :system_templates, -> { where(is_system: true) }
  scope :user_templates, -> { where(is_system: false) }
  scope :ordered, -> { order(:category, :name) }

  # Categories
  CATEGORIES = %w[doors windows rooms electrical plumbing hvac custom].freeze

  # Configuration structure:
  # {
  #   "steps": [
  #     {
  #       "type": "count" | "area" | "linear" | "perimeter",
  #       "label": "Door Count",
  #       "color": "#3B82F6",
  #       "prompt": "Click on each door location",
  #       "pricebook_item_id": 123  // optional
  #     }
  #   ]
  # }

  def steps
    configuration["steps"] || []
  end

  def step_count
    steps.length
  end

  # Increment usage counter
  def record_usage!
    increment!(:usage_count)
  end

  # Duplicate template for user customization
  def duplicate_for(user)
    dup.tap do |copy|
      copy.name = "#{name} (Copy)"
      copy.is_system = false
      copy.created_by = user
      copy.usage_count = 0
    end
  end

  private

  def validate_configuration_structure
    return if configuration.blank?

    unless configuration.is_a?(Hash)
      errors.add(:configuration, "must be a hash")
      return
    end

    steps = configuration["steps"]
    unless steps.is_a?(Array)
      errors.add(:configuration, "must have a 'steps' array")
      return
    end

    valid_types = %w[count area linear perimeter]
    steps.each_with_index do |step, idx|
      unless step.is_a?(Hash)
        errors.add(:configuration, "step #{idx + 1} must be a hash")
        next
      end

      unless step["type"].in?(valid_types)
        errors.add(:configuration, "step #{idx + 1} has invalid type '#{step["type"]}'")
      end

      unless step["label"].present?
        errors.add(:configuration, "step #{idx + 1} must have a label")
      end
    end
  end
end
