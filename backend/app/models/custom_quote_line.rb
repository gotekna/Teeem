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

  # Returns document types for this line (from array column)
  def document_types
    return DocumentType.none if document_type_ids.blank?
    DocumentType.where(id: document_type_ids)
  end

  def as_tree_node(doc_type_map: nil)
    # Build map on first call if not provided (preloads for all lines)
    if doc_type_map.nil?
      all_ids = [document_type_ids, *children.map(&:document_type_ids)].flatten.compact.uniq
      doc_type_map = all_ids.present? ? DocumentType.where(id: all_ids).pluck(:id, :name).to_h : {}
    end

    {
      id: id,
      name: name,
      quoteLevel: quote_level,
      costCentreId: cost_centre_id,
      smScheduleMasterId: sm_schedule_master_id,
      smTaskId: sm_task_id,
      documentTypeIds: document_type_ids || [],
      documentTypeNames: (document_type_ids || []).filter_map { |dtid| doc_type_map[dtid] },
      tenderDescription: tender_description,
      poDescription: po_description,
      rfqInstructions: rfq_instructions,
      budgetAmount: budget_amount&.to_f,
      position: position,
      suppliers: suppliers.includes(:supplier).order(:created_at).map(&:as_json_summary),
      children: children.order(:position).includes(suppliers: :supplier).map { |c| c.as_tree_node(doc_type_map: doc_type_map) }
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
