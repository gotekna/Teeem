# frozen_string_literal: true

# CustomQuoteTemplateLine - A line in a custom quote template (self-referential tree)
#
# Tree structure:
#   parent_id = NULL → Cost Centre line (root)
#   parent_id = CC line → PO line (child)
#
# quote_level:
#   'cost_centre' → Suppliers assigned at CC level, then allocated to PO children
#   'po' (default) → Suppliers assigned to individual PO children
#
class CustomQuoteTemplateLine < ApplicationRecord
  QUOTE_LEVELS = %w[cost_centre po].freeze

  # Associations
  belongs_to :custom_quote_template
  belongs_to :parent, class_name: "CustomQuoteTemplateLine", optional: true
  belongs_to :cost_centre, optional: true
  belongs_to :sm_schedule_master, optional: true
  has_many :children, class_name: "CustomQuoteTemplateLine",
           foreign_key: :parent_id, dependent: :destroy

  # Validations
  validates :name, presence: true, length: { maximum: 200 }
  validates :quote_level, inclusion: { in: QUOTE_LEVELS }
  validate :parent_not_self
  validate :valid_tree_structure

  # Scopes
  scope :roots, -> { where(parent_id: nil) }
  scope :ordered, -> { order(:position) }

  def cost_centre_line?
    parent_id.nil?
  end

  def po_line?
    parent_id.present?
  end

  def as_tree_node
    {
      id: id,
      name: name,
      quote_level: quote_level,
      cost_centre_id: cost_centre_id,
      sm_schedule_master_id: sm_schedule_master_id,
      tender_description: tender_description,
      po_description: po_description,
      default_instructions: default_instructions,
      default_supplier_ids: default_supplier_ids,
      position: position,
      children: children.order(:position).map(&:as_tree_node)
    }
  end

  private

  def parent_not_self
    return if new_record?
    return unless parent_id.present? && parent_id == id
    errors.add(:parent_id, "cannot be self")
  end

  def valid_tree_structure
    # Only CC lines (roots) can have quote_level = 'cost_centre'
    if quote_level == 'cost_centre' && parent_id.present?
      errors.add(:quote_level, "cost_centre level is only valid for root (CC) lines")
    end
  end
end
