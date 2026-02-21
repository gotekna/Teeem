# frozen_string_literal: true

# TendersController - Manages tender sections/headers and their PO task assignments.
#
# Two-level hierarchy: headers (parent_id = nil) group sections (parent_id set).
# Tender sections group PO line items into sections for tender documents
# (e.g., "Base Price & Essential Inclusions", "Site Costs").
#
# PO Tasks are assigned via sm_schedule_masters.tender_id, same pattern
# as Cost Centres use sm_schedule_masters.cost_centre.
#
class Api::V1::TendersController < ApplicationController
  before_action :set_tender, only: [:assign_po_tasks]

  # GET /api/v1/tenders/tree
  # Returns hierarchical header > sections structure for the tender document system
  def tree
    render json: { success: true, data: Tender.tree }
  end

  # GET /api/v1/tenders/headers
  # Returns headers-only (parent_id = nil) for dropdown selection in sections tab
  def headers
    headers_list = Tender.headers.active.ordered.select(:id, :code, :name, :sort_order)
    render json: {
      success: true,
      data: headers_list.map { |h| { id: h.id, code: h.code, name: h.name, sortOrder: h.sort_order } }
    }
  end

  # GET /api/v1/tenders/po_tasks
  # Returns all SmScheduleMaster records where po_required=true, with current tender assignment
  def po_tasks
    tasks = SmScheduleMaster.where(po_required: true).order(:task_number, :name)

    # Build a lookup of tender names for display
    tender_ids = tasks.pluck(:tender_id).compact.uniq
    tender_names = Tender.where(id: tender_ids).pluck(:id, :name).to_h

    render json: {
      success: true,
      data: tasks.map { |t|
        {
          id: t.id,
          name: t.name,
          taskCode: t.task_code,
          taskNumber: t.task_number,
          tenderId: t.tender_id,
          tenderName: t.tender_id.present? ? tender_names[t.tender_id] : nil,
          templateIds: t.sm_template_ids || []
        }
      }
    }
  end

  # POST /api/v1/tenders/:id/assign_po_tasks
  # Accepts { po_task_ids: [1, 2, 3] } and updates SmScheduleMaster.tender_id
  #
  # Propagates tender_id to ALL SmScheduleMaster records with matching names
  # (same tenant, po_required: true). This ensures job tasks created from older
  # template versions are also found when querying by tender section.
  def assign_po_tasks
    po_task_ids = params[:po_task_ids] || []

    ActiveRecord::Base.transaction do
      # Get names of tasks being unassigned from this tender
      removed_names = SmScheduleMaster.where(tender_id: @tender.id)
                                      .where.not(id: po_task_ids)
                                      .pluck(:name).uniq

      # Clear tender_id from unassigned tasks
      SmScheduleMaster.where(tender_id: @tender.id)
                      .where.not(id: po_task_ids)
                      .update_all(tender_id: nil)

      # Also clear name-matched siblings (other template versions with same name)
      if removed_names.any?
        SmScheduleMaster.where(name: removed_names, tender_id: @tender.id)
                        .update_all(tender_id: nil)
      end

      # Assign the specified tasks to this tender section
      if po_task_ids.present?
        assigned = SmScheduleMaster.where(id: po_task_ids)
        assigned.update_all(tender_id: @tender.id)

        # Propagate to all SmScheduleMaster records with matching names
        assigned_names = assigned.pluck(:name).uniq
        if assigned_names.any?
          SmScheduleMaster.where(name: assigned_names, po_required: true)
                          .where.not(tender_id: @tender.id)
                          .update_all(tender_id: @tender.id)
        end
      end
    end

    render json: { success: true, message: "PO tasks updated" }
  end

  private

  def set_tender
    @tender = Tender.find(params[:id])
  rescue ActiveRecord::RecordNotFound
    render_error("Tender section not found", status: :not_found)
  end
end
