# frozen_string_literal: true

class PoTemplatePack < ApplicationRecord
  acts_as_tenant :tenant
  include ConfigSyncable
  self.sync_key_source = :name

  # Associations
  belongs_to :created_by, class_name: "User", optional: true
  belongs_to :updated_by, class_name: "User", optional: true
  has_many :po_template_items, -> { order(:position) }, dependent: :destroy

  accepts_nested_attributes_for :po_template_items, allow_destroy: true

  # Validations
  validates :name, presence: true, length: { maximum: 100 },
                   uniqueness: { scope: :tenant_id, case_sensitive: false }

  # Scopes
  scope :active, -> { where(is_active: true) }
  scope :ordered, -> { order(:position, :name) }

  def item_count
    po_template_items.size
  end

  def estimated_total
    po_template_items.sum { |item|
      item.po_template_line_items.sum { |li| (li.quantity || 0) * (li.unit_price || 0) }
    }
  end
end
