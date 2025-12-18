# Per-job plan tabs (like JobDocumentationTab)
# Each job gets a copy of PlanCategories as tabs
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

  # Get all plans under this tab (including from child tabs)
  def all_plans
    JobPlan.where(job_plan_tab_id: [id] + children.pluck(:id))
  end

  # Count of plans on issue in this tab
  def on_issue_count
    all_plans.joins(:current_revision).where(job_plan_revisions: { is_on_issue: true }).count
  end
end
