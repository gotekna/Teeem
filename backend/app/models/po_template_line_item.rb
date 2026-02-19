# frozen_string_literal: true

class PoTemplateLineItem < ApplicationRecord
  acts_as_tenant :tenant

  # Associations
  belongs_to :po_template_item
  belongs_to :pricebook_item, optional: true

  # Validations
  validates :description, presence: true
  validates :quantity, numericality: { allow_nil: false }
  validates :unit_price, numericality: { allow_nil: false }
  validates :line_number, presence: true, numericality: { only_integer: true, greater_than: 0 }
  validate :gst_code_exists_in_database

  # Callbacks
  before_validation :set_line_number, if: :new_record?
  before_validation :cache_pricebook_item_code

  def subtotal
    (quantity || 0) * (unit_price || 0)
  end

  private

  def set_line_number
    return if line_number.present?

    max_line = po_template_item&.po_template_line_items&.maximum(:line_number) || 0
    self.line_number = max_line + 1
  end

  def cache_pricebook_item_code
    if pricebook_item_id_changed? && pricebook_item.present?
      self.pricebook_item_code = pricebook_item.item_code
    end
  end

  def gst_code_exists_in_database
    return if gst_code.blank?
    unless GstCode.active.exists?(code: gst_code)
      errors.add(:gst_code, "\"#{gst_code}\" is not a valid active GST code")
    end
  end
end
