# DEPRECATED: Use SmTask instead
# This model is being replaced by SmTask as part of SSoT consolidation.
# The SmTask system uses the `tasks` table and provides full SM Gantt functionality.
# This model will be removed in a future release.
#
# Migration path:
# - Import functionality should use SmTaskImportService (to be created)
# - Frontend should use /api/v1/sm_tasks instead of /api/v1/schedule_tasks
# - Gantt display should use SmTask via SmTasksController
#
class ScheduleTask < ApplicationRecord
  include Deprecatable

  after_find { log_deprecation("ScheduleTask is deprecated. Use SmTask instead.") }

  # Associations
  belongs_to :job
  belongs_to :purchase_order, optional: true
  has_many :schedule_task_checklist_items, dependent: :destroy

  # Validations
  validates :title, presence: true
  validates :job_id, presence: true

  # Scopes
  scope :matched, -> { where(matched_to_po: true) }
  scope :unmatched, -> { where(matched_to_po: false) }
  scope :by_sequence, -> { order(:sequence_order) }
  scope :for_gantt, -> { matched.order(:start_date) }

  # Callbacks
  before_save :parse_duration
  before_save :update_matched_status

  # Match this task to a purchase order
  def match_to_purchase_order!(po)
    update!(
      purchase_order: po,
      matched_to_po: true
    )
  end

  # Unmatch from purchase order
  def unmatch_from_purchase_order!
    update!(
      purchase_order: nil,
      matched_to_po: false
    )
  end

  # Format for Gantt chart display
  def to_gantt_format
    {
      id: id,
      title: title,
      start_date: start_date,
      end_date: complete_date || calculate_end_date,
      duration_days: duration_days,
      status: status,
      supplier_category: supplier_category,
      supplier_name: supplier_name,
      purchase_order_id: purchase_order_id,
      purchase_order_number: purchase_order&.purchase_order_number,
      predecessors: predecessors,
      progress: calculate_progress
    }
  end

  # Calculate end date based on start date and duration
  def calculate_end_date
    return nil unless start_date && duration_days
    start_date + duration_days.days
  end

  # Calculate progress percentage based on status
  def calculate_progress
    case status
    when "completed", "Completed"
      100
    when "in_progress", "In Progress"
      50
    when "not_started", "Not Started"
      0
    else
      0
    end
  end

  # Suggest matching purchase orders based on title and supplier
  def suggested_purchase_orders(limit = 5)
    job.purchase_orders.where.not(id: purchase_order_id).where(
      "LOWER(description) LIKE ? OR LOWER(ted_task) LIKE ?",
      "%#{title.downcase}%",
      "%#{title.downcase}%"
    ).limit(limit)
  end

  private

  # Parse duration string (e.g., "5d", "21d") to integer
  def parse_duration
    return unless duration.present?

    if duration.match?(/(\d+)d/i)
      self.duration_days = duration.match(/(\d+)d/i)[1].to_i
    elsif duration.to_i > 0
      self.duration_days = duration.to_i
    end
  end

  # Update matched status based on purchase_order presence
  def update_matched_status
    self.matched_to_po = purchase_order_id.present?
  end
end
