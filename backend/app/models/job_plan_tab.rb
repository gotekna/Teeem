# Each job gets a copy of PlanCategories as tabs
#
# MASTERPIECE: Counter caches for O(1) count lookups
# - plans_count: maintained by JobPlan counter_cache
# - on_issue_plans_count: maintained by JobPlan callbacks
#
class JobPlanTab < ApplicationRecord
  belongs_to :job
  belongs_to :plan_category, optional: true
  belongs_to :parent, class_name: 'JobPlanTab', optional: true
  has_many :children, class_name: 'JobPlanTab', foreign_key: :parent_id, dependent: :destroy
  has_many :job_plans, dependent: :nullify

  validates :name, presence: true

  scope :active, -> { where(is_active: true) }
  scope :ordered, -> { order(:sequence_order, :name) }
  scope :root_tabs, -> { where(parent_id: nil) }

  # MASTERPIECE: Efficient counts using counter caches
  # Returns total plans including all children tabs
  def total_plans_count
    plans_count + children.sum(:plans_count)
  end

  # Returns total on-issue plans including all children tabs
  def total_on_issue_count
    on_issue_plans_count + children.sum(:on_issue_plans_count)
  end

  # Get all plans under this tab (including from child tabs)
  # MEMOIZED to avoid repeated queries in the same request
  def all_plans
    @all_plans ||= JobPlan.where(job_plan_tab_id: descendant_ids)
  end

  # Count of plans on issue in this tab (LEGACY - use total_on_issue_count for counter cache)
  def on_issue_count
    all_plans.joins(:current_revision).where(job_plan_revisions: { is_on_issue: true }).count
  end

  # Reset memoization (call after data changes in the same request)
  def reset_memoization!
    @all_plans = nil
    @descendant_ids = nil
  end

  private

  # Get all tab IDs (self + all children)
  # MEMOIZED to avoid repeated pluck queries
  def descendant_ids
    @descendant_ids ||= [id] + children.pluck(:id)
  end
end
