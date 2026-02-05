# frozen_string_literal: true

# TakeoffLayer - Visual grouping layer for PDF takeoff measurements
#
# Layers help organize measurements by category with color coding.
# Similar to CAD layers, users can toggle visibility and lock layers.
#
# Example layers:
#   - "Flooring" (blue) - floor area measurements
#   - "Walls" (green) - wall area and linear measurements
#   - "Electrical" (yellow) - GPO counts, light counts
#   - "Plumbing" (red) - fixture counts
#
class TakeoffLayer < ApplicationRecord
  acts_as_tenant :tenant

  # Associations
  belongs_to :tenant
  belongs_to :job
  has_many :measurements, class_name: "UnrealMeasurement", dependent: :nullify

  # Validations
  validates :name, presence: true
  validates :name, uniqueness: { scope: :job_id, message: "already exists for this job" }
  validates :color, presence: true, format: { with: /\A#[0-9A-Fa-f]{6}\z/, message: "must be a valid hex color" }
  validates :display_order, presence: true, numericality: { only_integer: true }

  # Scopes
  scope :visible, -> { where(visible: true) }
  scope :unlocked, -> { where(locked: false) }
  scope :ordered, -> { order(:display_order) }

  # Callbacks
  before_validation :set_default_order, on: :create

  # =============================================================================
  # Default Layers (SSoT)
  # =============================================================================

  DEFAULT_LAYERS = [
    { name: "General", color: "#6B7280", display_order: 0 },  # Gray
    { name: "Flooring", color: "#3B82F6", display_order: 1 },  # Blue
    { name: "Walls", color: "#22C55E", display_order: 2 },  # Green
    { name: "Ceiling", color: "#A855F7", display_order: 3 },  # Purple
    { name: "Electrical", color: "#EAB308", display_order: 4 },  # Yellow
    { name: "Plumbing", color: "#EF4444", display_order: 5 },  # Red
    { name: "HVAC", color: "#06B6D4", display_order: 6 },  # Cyan
    { name: "Roofing", color: "#F97316", display_order: 7 },  # Orange
  ].freeze

  # =============================================================================
  # Class Methods
  # =============================================================================

  # Create default layers for a job
  def self.create_defaults_for(job)
    DEFAULT_LAYERS.each do |layer_attrs|
      find_or_create_by!(job: job, name: layer_attrs[:name]) do |layer|
        layer.color = layer_attrs[:color]
        layer.display_order = layer_attrs[:display_order]
      end
    end
  end

  # Get or create the "General" layer for a job
  def self.general_layer_for(job)
    find_or_create_by!(job: job, name: "General") do |layer|
      layer.color = "#6B7280"
      layer.display_order = 0
    end
  end

  # =============================================================================
  # Instance Methods
  # =============================================================================

  # Count of measurements in this layer
  def measurement_count
    measurements.count
  end

  # Total value by measurement type
  def total_for(measurement_type)
    measurements.where(measurement_type: measurement_type).sum(:value)
  end

  # Summary of measurements
  def summary
    {
      count: measurement_count,
      area_m2: total_for("area").round(2),
      length_m: total_for("length").round(2),
      item_count: total_for("count").to_i
    }
  end

  # For API responses
  def as_json(options = {})
    super(options.merge(
      only: [:id, :name, :color, :display_order, :visible, :locked],
      methods: [:measurement_count]
    ))
  end

  private

  def set_default_order
    return if display_order.present?

    max_order = self.class.where(job_id: job_id).maximum(:display_order) || -1
    self.display_order = max_order + 1
  end
end
