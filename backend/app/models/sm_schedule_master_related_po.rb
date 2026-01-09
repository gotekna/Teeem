# frozen_string_literal: true

# Join model linking SmScheduleMaster rows to their related PO tasks.
# When a PO is auto-created from a template, the description will include
# supplier contact info for all related PO tasks.
#
# Example: "Req Carpenter" links to ["Req Crane", "Req Roof Trusses"]
# When Carpenter's PO is created, it will include Crane and Roof Trusses
# supplier names and phone numbers for coordination.
class SmScheduleMasterRelatedPo < ApplicationRecord
  belongs_to :sm_schedule_master
  belongs_to :related_sm_schedule_master, class_name: "SmScheduleMaster"

  # Validations
  validates :sm_schedule_master_id, uniqueness: { scope: :related_sm_schedule_master_id }
  validate :related_task_must_be_different
  validate :related_task_must_be_po_required

  # Ordering
  default_scope { order(:position) }

  private

  def related_task_must_be_different
    if sm_schedule_master_id == related_sm_schedule_master_id
      errors.add(:related_sm_schedule_master, "cannot be the same as the parent task")
    end
  end

  def related_task_must_be_po_required
    if related_sm_schedule_master && !related_sm_schedule_master.po_required?
      errors.add(:related_sm_schedule_master, "must be a PO task (po_required = true)")
    end
  end
end
