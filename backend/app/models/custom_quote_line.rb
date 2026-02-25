# frozen_string_literal: true

# CustomQuoteLine - A line within a job's custom quote (self-referential tree)
#
# Tree structure:
#   parent_id = NULL → Cost Centre line (root)
#   parent_id = CC line → PO line (child)
#
# quote_level:
#   'cost_centre' → Suppliers assigned at CC level, allocate to PO children
#   'po' (default) → Suppliers assigned to individual PO children
#   'not_required' → CC excluded from quoting (no suppliers needed)
#
# SmTask resolution:
#   sm_schedule_master_id = template-level PO Task (from template)
#   sm_task_id = job-level task instance (resolved when applied to job)
#
class CustomQuoteLine < ApplicationRecord
  QUOTE_LEVELS = %w[cost_centre po not_required].freeze

  # Associations
  belongs_to :custom_quote
  belongs_to :parent, class_name: "CustomQuoteLine", optional: true
  belongs_to :cost_centre, optional: true
  belongs_to :sm_schedule_master, optional: true
  belongs_to :sm_task, class_name: "SmTask", optional: true
  has_many :children, class_name: "CustomQuoteLine",
           foreign_key: :parent_id, dependent: :destroy
  has_many :suppliers, class_name: "CustomQuoteSupplier",
           dependent: :destroy
  has_many :allocations, class_name: "CustomQuoteAllocation",
           dependent: :destroy

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

  # Best price among responded/accepted suppliers
  def best_price
    suppliers.where(status: %w[responded accepted]).minimum(:price_quoted)
  end

  # Accepted supplier (if any)
  def accepted_supplier
    suppliers.find_by(status: 'accepted')
  end

  # Total allocated to this PO line (from CC-level quotes)
  def total_allocated
    allocations.sum(:allocated_amount)
  end

  def as_tree_node
    {
      id: id,
      name: name,
      quote_level: quote_level,
      cost_centre_id: cost_centre_id,
      sm_schedule_master_id: sm_schedule_master_id,
      sm_task_id: sm_task_id,
      tender_description: tender_description,
      po_description: po_description,
      rfq_instructions: rfq_instructions,
      budget_amount: budget_amount&.to_f,
      position: position,
      suppliers: suppliers.includes(:supplier).order(:created_at).map(&:as_json_summary),
      children: children.order(:position).includes(suppliers: :supplier).map(&:as_tree_node)
    }
  end

  private

  def parent_not_self
    return if new_record?
    return unless parent_id.present? && parent_id == id
    errors.add(:parent_id, "cannot be self")
  end

  def valid_tree_structure
    if quote_level == 'cost_centre' && parent_id.present?
      errors.add(:quote_level, "cost_centre level is only valid for root (CC) lines")
    end
  end
end
