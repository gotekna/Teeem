# frozen_string_literal: true

# TakeoffLayer - Visual grouping layer for PDF takeoff measurements
#
# Layers help organize measurements by category with color coding.
# Similar to CAD layers, users can toggle visibility and lock layers.
#
# Belongs to EITHER a Job OR a DocsortItem (one must be set).
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
  belongs_to :job, optional: true
  belongs_to :docsort_item, optional: true
  has_many :measurements, class_name: "UnrealMeasurement", dependent: :nullify

  # Validations
  validates :name, presence: true
  validates :name, uniqueness: { scope: :job_id, message: "already exists for this job" }, if: :job_id?
  validates :name, uniqueness: { scope: :docsort_item_id, message: "already exists for this item" }, if: :docsort_item_id?
  validates :color, presence: true, format: { with: /\A#[0-9A-Fa-f]{6}\z/, message: "must be a valid hex color" }
  validates :display_order, presence: true, numericality: { only_integer: true }
  validate :must_belong_to_job_or_docsort_item

  # Scopes
  scope :visible, -> { where(visible: true) }
  scope :unlocked, -> { where(locked: false) }
  scope :ordered, -> { order(:display_order) }
  scope :for_job, ->(job) { where(job: job) }
  scope :for_docsort_item, ->(item) { where(docsort_item: item) }

  # Callbacks
  before_validation :set_default_order, on: :create

  # =============================================================================
  # Default Layers (SSoT)
  # =============================================================================

  DEFAULT_LAYERS = [
    { name: "Measurements", color: "#3B82F6", display_order: 0 },  # Blue
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

  # Create default layers for a docsort item
  def self.create_defaults_for_docsort(docsort_item)
    DEFAULT_LAYERS.each do |layer_attrs|
      find_or_create_by!(docsort_item: docsort_item, name: layer_attrs[:name]) do |layer|
        layer.color = layer_attrs[:color]
        layer.display_order = layer_attrs[:display_order]
      end
    end
  end

  # Get or create the default layer for a job
  def self.default_layer_for(job)
    find_or_create_by!(job: job, name: "Measurements") do |layer|
      layer.color = "#3B82F6"
      layer.display_order = 0
    end
  end

  # Get or create the default layer for a docsort item
  def self.default_layer_for_docsort(docsort_item)
    find_or_create_by!(docsort_item: docsort_item, name: "Measurements") do |layer|
      layer.color = "#3B82F6"
      layer.display_order = 0
    end
  end

  # Kept for backwards compatibility with existing job layers
  def self.general_layer_for(job)
    default_layer_for(job)
  end

  # =============================================================================
  # Instance Methods
  # =============================================================================

  # The parent owner (job or docsort item)
  def owner
    job || docsort_item
  end

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

  def must_belong_to_job_or_docsort_item
    if job_id.blank? && docsort_item_id.blank?
      errors.add(:base, "Must belong to either a job or a docsort item")
    end
    if job_id.present? && docsort_item_id.present?
      errors.add(:base, "Cannot belong to both a job and a docsort item")
    end
  end

  def set_default_order
    return if display_order.present?

    scope = job_id ? self.class.where(job_id: job_id) : self.class.where(docsort_item_id: docsort_item_id)
    max_order = scope.maximum(:display_order) || -1
    self.display_order = max_order + 1
  end
end
