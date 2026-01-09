# frozen_string_literal: true

# PdfFieldPosition stores the x,y coordinates for text overlay fields in PDF templates.
# This is the SSoT for PDF field positioning, replacing hardcoded values in PdfOverlayEngine.
#
# Templates supported:
# - qbcc_contract: QBCC New Home Construction Contract
# - qbcc_consumer_guide: QBCC Consumer Building Guide
# - qbcc_general_conditions: QBCC General Conditions (page 16)
#
class PdfFieldPosition < ApplicationRecord
  # Validations
  validates :pdf_template_key, presence: true
  validates :field_key, presence: true, uniqueness: { scope: :pdf_template_key }
  validates :page, presence: true, numericality: { greater_than: 0 }
  validates :x, presence: true, numericality: true
  validates :y, presence: true, numericality: true
  validates :font_size, numericality: { greater_than: 0 }, allow_nil: true

  # Scopes
  scope :active, -> { where(active: true) }
  scope :for_template, ->(key) { where(pdf_template_key: key) }
  scope :on_page, ->(page_num) { where(page: page_num) }

  # Available template keys
  TEMPLATE_KEYS = %w[qbcc_contract qbcc_consumer_guide qbcc_general_conditions].freeze

  # Get all field positions for a template as a hash (format expected by PdfOverlayEngine)
  # Returns: { field_key: { type: :text, page: 1, x: 100, y: 200, size: 10 }, ... }
  def self.positions_for_template(template_key)
    active.for_template(template_key).each_with_object({}) do |field, hash|
      hash[field.field_key.to_sym] = {
        type: :text,
        page: field.page,
        x: field.x.to_f,
        y: field.y.to_f,
        size: field.font_size || 10
      }
    end
  end

  # Convert to the hash format expected by PdfOverlayEngine
  def to_overlay_config
    {
      type: :text,
      page: page,
      x: x.to_f,
      y: y.to_f,
      size: font_size || 10
    }
  end
end
