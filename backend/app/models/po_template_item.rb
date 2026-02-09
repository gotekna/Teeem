# frozen_string_literal: true

class PoTemplateItem < ApplicationRecord
  acts_as_tenant :tenant
  include ConfigSyncable
  self.sync_key_source = :name

  # Associations
  belongs_to :po_template_pack
  belongs_to :sm_schedule_master, optional: true
  belongs_to :supplier, class_name: "Contact", optional: true
  has_many :po_template_line_items, -> { order(:line_number) }, dependent: :destroy

  accepts_nested_attributes_for :po_template_line_items, allow_destroy: true

  # Validations
  validates :name, presence: true, length: { maximum: 200 }
  validates :position, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :status_on_create, inclusion: {
    in: %w[draft pending approved]
  }, allow_nil: true

  # Cache supplier display_name for cross-tenant matching
  before_save :cache_supplier_sync_key

  def line_item_total
    po_template_line_items.sum { |li| (li.quantity || 0) * (li.unit_price || 0) }
  end

  private

  def cache_supplier_sync_key
    if supplier_id_changed? && supplier.present?
      self.supplier_sync_key = supplier.display_name
    end
  end
end
