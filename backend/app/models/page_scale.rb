# frozen_string_literal: true

# PageScale - Scale calibration data for PDF takeoff measurements
#
# Each page of a job plan can have its own scale calibration.
# Users calibrate by drawing a reference line and entering the real-world length.
#
# Scale factor calculation:
#   scale_factor = reference_length_mm / reference_length_px
#   real_mm = pixel_length * scale_factor
#
# Example:
#   User draws line across door (820mm) = 164 pixels
#   scale_factor = 820 / 164 = 5.0 mm/px
#   A rectangle 200x100 pixels = 1000mm x 500mm = 0.5m²
#
class PageScale < ApplicationRecord
  acts_as_tenant :tenant

  # Associations
  belongs_to :tenant
  belongs_to :job_plan, optional: true  # Optional for DocSort standalone takeoff
  belongs_to :job_plan_revision, optional: true
  belongs_to :document_inbox, optional: true  # For standalone takeoff from DocSort
  belongs_to :calibrated_by, class_name: "User", optional: true

  # Validations
  validates :page_number, presence: true, numericality: { greater_than: 0 }
  validates :job_plan_id, uniqueness: { scope: :page_number, message: "already has a scale for this page" }, allow_nil: true
  validates :document_inbox_id, uniqueness: { scope: :page_number, message: "already has a scale for this page" }, allow_nil: true
  validates :scale_factor, numericality: { greater_than: 0 }, allow_nil: true
  validates :reference_length_mm, numericality: { greater_than: 0 }, allow_nil: true
  validates :reference_length_px, numericality: { greater_than: 0 }, allow_nil: true
  validates :ai_confidence, numericality: { in: 0..1 }, allow_nil: true
  validate :job_plan_or_docsort_present

  # Custom validation: must belong to either a job_plan or a document_inbox
  def job_plan_or_docsort_present
    return if job_plan_id.present? || document_inbox_id.present?
    errors.add(:base, "PageScale must belong to either a job_plan or a document_inbox")
  end

  # Scopes
  scope :calibrated, -> { where.not(scale_factor: nil) }
  scope :uncalibrated, -> { where(scale_factor: nil) }
  scope :for_page, ->(page_num) { where(page_number: page_num) }
  scope :for_docsort, ->(document_inbox) { where(document_inbox: document_inbox) }

  # Callbacks
  before_save :calculate_scale_factor, if: :should_calculate_scale?

  # =============================================================================
  # Class Methods
  # =============================================================================

  # Find or create scale for a specific page
  def self.for_job_plan_page(job_plan, page_number)
    find_or_initialize_by(job_plan: job_plan, page_number: page_number)
  end

  # Find or create scale for a DocumentInbox page
  def self.for_docsort_page(document_inbox, page_number)
    find_or_initialize_by(document_inbox: document_inbox, page_number: page_number)
  end

  # =============================================================================
  # Instance Methods
  # =============================================================================

  # Check if page has been calibrated
  def calibrated?
    scale_factor.present? && scale_factor.positive?
  end

  # Convert pixel measurement to millimeters
  def pixels_to_mm(pixels)
    return nil unless calibrated?

    pixels * scale_factor
  end

  # Convert pixel measurement to meters
  def pixels_to_m(pixels)
    mm = pixels_to_mm(pixels)
    mm ? mm / 1000.0 : nil
  end

  # Calculate area in m² from pixel area
  def pixel_area_to_m2(pixel_area)
    return nil unless calibrated?

    # Area scales with square of linear scale
    mm2 = pixel_area * (scale_factor**2)
    mm2 / 1_000_000.0  # mm² to m²
  end

  # Calculate length in meters from pixel length
  def pixel_length_to_m(pixel_length)
    pixels_to_m(pixel_length)
  end

  # Get display-friendly scale ratio (e.g., "1:100")
  def display_scale
    return scale_label if scale_label.present?
    return "Not calibrated" unless calibrated?

    # Calculate approximate scale ratio
    # 1:100 means 1mm on paper = 100mm in real life
    # scale_factor is mm/px, so we need to know paper DPI
    # For now, just show the scale factor
    "#{scale_factor.round(2)} mm/px"
  end

  # Calibration line coordinates for display
  def line_coordinates
    return nil if calibration_line.blank?

    {
      x1: calibration_line["x1"],
      y1: calibration_line["y1"],
      x2: calibration_line["x2"],
      y2: calibration_line["y2"]
    }
  end

  # Set calibration from user input
  def set_calibration(reference_mm:, line_start:, line_end:, canvas_width: nil, canvas_height: nil, user: nil)
    # Calculate pixel distance
    dx = line_end[:x] - line_start[:x]
    dy = line_end[:y] - line_start[:y]
    pixel_length = Math.sqrt(dx**2 + dy**2)

    self.reference_length_mm = reference_mm
    self.reference_length_px = pixel_length
    self.calibration_line = {
      x1: line_start[:x],
      y1: line_start[:y],
      x2: line_end[:x],
      y2: line_end[:y],
      canvasWidth: canvas_width,
      canvasHeight: canvas_height
    }.compact
    self.calibrated_by = user
    self.calibrated_at = Time.current

    # scale_factor calculated in callback
    save
  end

  private

  def should_calculate_scale?
    reference_length_mm.present? && reference_length_px.present? &&
      (reference_length_mm_changed? || reference_length_px_changed?)
  end

  def calculate_scale_factor
    return if reference_length_px.zero?

    self.scale_factor = reference_length_mm / reference_length_px
  end
end
