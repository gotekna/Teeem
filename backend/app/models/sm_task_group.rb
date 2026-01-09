# frozen_string_literal: true

# SmTaskGroup - Groups PO and non-PO tasks together for visibility inheritance
#
# When ANY PO task in a group is added to a job, ALL non-PO tasks in the group
# automatically appear (deduplicated - each task appears only once regardless
# of how many POs from the group are on the job).
#
# Example:
#   Group: "NDIS Tasks"
#   PO Tasks: NDIS Plumbing, NDIS Electrical, NDIS Carpentry
#   Non-PO Tasks: NDIS Final Inspection
#
#   When any NDIS PO is on a job, NDIS Final Inspection appears (once).
#
class SmTaskGroup < ApplicationRecord
  has_many :sm_schedule_masters, dependent: :nullify

  validates :name, presence: true

  scope :active, -> { where(is_active: true) }

  # Get all PO tasks in this group
  def po_tasks
    sm_schedule_masters.where(po_required: true)
  end

  # Get all non-PO tasks in this group
  def linked_tasks
    sm_schedule_masters.where(po_required: false)
  end

  # Check if any PO from this group exists on the given job
  def any_po_on_job?(job)
    po_task_ids = po_tasks.pluck(:id)
    return false if po_task_ids.empty?

    job.sm_tasks.where(sm_schedule_master_id: po_task_ids).exists?
  end
end
