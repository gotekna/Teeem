# frozen_string_literal: true

# CostCentre - Business segment tracking for cost allocation (simPRO-style)
#
# Part of Site Presence & Cost Intelligence System
# See: .claude/plans/piped-orbiting-whisper.md
#
# Cost centres enable P&L tracking by business segment (e.g., "Residential Projects"
# vs "Commercial Projects"). They support hierarchy for department → division → region.
#
# Key Features:
# - Hierarchical structure (parent/child relationships)
# - Overhead allocation percentage for cost loading
# - Budget tracking by cost centre
# - Employee/subcontractor assignment to primary cost centre
#
class CostCentre < ApplicationRecord
  # Centre types
  CENTRE_TYPES = %w[department project division region other].freeze

  # Associations
  belongs_to :parent, class_name: "CostCentre", optional: true
  has_many :children, class_name: "CostCentre", foreign_key: :parent_id, dependent: :nullify

  has_many :worker_profiles, dependent: :nullify
  has_many :site_presence_sessions, dependent: :nullify
  has_many :labour_cost_entries, dependent: :nullify
  has_many :job_cost_budgets, dependent: :nullify
  has_many :jobs, dependent: :nullify

  # Validations
  validates :code, presence: true, uniqueness: true, length: { maximum: 20 }
  validates :name, presence: true, length: { maximum: 100 }
  validates :centre_type, inclusion: { in: CENTRE_TYPES }, allow_nil: true
  validates :overhead_allocation_percent,
            numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 100 },
            allow_nil: true
  validates :budget_amount, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true

  # Prevent circular parent references
  validate :parent_not_self
  validate :parent_not_descendant

  # Scopes
  scope :active, -> { where(active: true) }
  scope :inactive, -> { where(active: false) }
  scope :roots, -> { where(parent_id: nil) }
  scope :by_type, ->(type) { where(centre_type: type) }
  scope :ordered, -> { order(:code) }

  # Instance methods

  # Get all ancestors (parent, grandparent, etc.)
  def ancestors
    result = []
    current = parent
    while current
      result << current
      current = current.parent
    end
    result
  end

  # Get all descendants (children, grandchildren, etc.)
  def descendants
    result = []
    children.each do |child|
      result << child
      result.concat(child.descendants)
    end
    result
  end

  # Get full path (e.g., "Division > Department > Team")
  def full_path
    (ancestors.reverse + [self]).map(&:name).join(" > ")
  end

  # Check if this is a root cost centre
  def root?
    parent_id.nil?
  end

  # Check if this is a leaf (no children)
  def leaf?
    children.empty?
  end

  # Get depth in hierarchy (0 for root)
  def depth
    ancestors.count
  end

  # Calculate total overhead for a cost (cascading through hierarchy)
  def total_overhead_percent
    (overhead_allocation_percent || 0) + (parent&.total_overhead_percent || 0)
  end

  # Get all labour cost entries for this cost centre and descendants
  def all_labour_cost_entries
    ids = [id] + descendants.pluck(:id)
    LabourCostEntry.where(cost_centre_id: ids)
  end

  # Calculate P&L summary for a date range
  def profit_loss_summary(start_date, end_date)
    entries = all_labour_cost_entries.where(entry_date: start_date..end_date)

    {
      cost_centre: slice(:id, :code, :name),
      period: { start: start_date, end: end_date },
      labour_cost: entries.sum(:total_cost),
      labour_hours: entries.sum(:regular_hours) +
                    entries.sum(:overtime_1_5x_hours) +
                    entries.sum(:overtime_2x_hours),
      billable_amount: entries.where(billable: true).sum(:billable_amount),
      margin: entries.where(billable: true).sum(:billable_amount) - entries.sum(:total_cost)
    }
  end

  # Class methods

  # Build tree structure for API response
  def self.tree
    roots.active.ordered.map { |root| root.as_tree_node }
  end

  def as_tree_node
    {
      id: id,
      code: code,
      name: name,
      centre_type: centre_type,
      overhead_allocation_percent: overhead_allocation_percent,
      children: children.active.ordered.map(&:as_tree_node)
    }
  end

  private

  def parent_not_self
    return if new_record? # Skip on new records since id is not yet assigned
    return unless parent_id.present? && parent_id == id

    errors.add(:parent_id, "cannot be self")
  end

  def parent_not_descendant
    return if new_record? # Skip on new records since there are no descendants yet
    return unless parent_id.present? && descendants.pluck(:id).include?(parent_id)

    errors.add(:parent_id, "cannot be a descendant (circular reference)")
  end
end
