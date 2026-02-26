# frozen_string_literal: true

# TendersController - Manages tender sections/headers and their PO task assignments.
#
# Two-level hierarchy: TenderHeader groups Tender sections.
# Tender sections group PO line items into sections for tender documents
# (e.g., "Base Price & Essential Inclusions", "Site Costs").
#
# PO Tasks are assigned via sm_schedule_masters.tender_id, same pattern
# as Cost Centres use sm_schedule_masters.cost_centre.
#
class Api::V1::TendersController < ApplicationController
  before_action :set_tender, only: [:assign_po_tasks, :update_document_types]

  # GET /api/v1/tenders/tree
  # Returns hierarchical header > sections structure for the tender document system
  def tree
    render json: { success: true, data: TenderHeader.tree }
  end

  # GET /api/v1/tenders/headers
  # Returns headers for dropdown selection in sections tab
  def headers
    headers_list = TenderHeader.active.ordered.select(:id, :code, :name, :sort_order)
    render json: {
      success: true,
      data: headers_list.map { |h| { id: h.id, code: h.code, name: h.name, sortOrder: h.sort_order } }
    }
  end

  # GET /api/v1/tenders/po_tasks
  # Returns all SmScheduleMaster records where po_required=true, with current tender assignment
  def po_tasks
    tasks = SmScheduleMaster.where(po_required: true).order(:task_number, :name)

    # Build a lookup of tender names + headers for display
    tender_ids = tasks.pluck(:tender_id).compact.uniq
    tenders_data = Tender.where(id: tender_ids).includes(:tender_header).index_by(&:id)

    # Build a lookup of cost centre names and codes for cross-reference display
    cost_centre_ids = tasks.pluck(:cost_centre).compact.uniq
    cost_centre_data = CostCentre.where(id: cost_centre_ids).pluck(:id, :name, :code)
    cost_centre_names = cost_centre_data.to_h { |id, name, _| [id, name] }
    cost_centre_codes = cost_centre_data.to_h { |id, _, code| [id, code] }

    render json: {
      success: true,
      data: tasks.map { |t|
        tender = t.tender_id.present? ? tenders_data[t.tender_id] : nil
        {
          id: t.id,
          name: t.name,
          taskCode: t.task_code,
          taskNumber: t.task_number,
          tenderId: t.tender_id,
          tenderName: tender&.name,
          tenderHeaderId: tender&.tender_header_id,
          tenderHeaderName: tender&.tender_header&.name,
          costCentreId: t.cost_centre,
          costCentreName: t.cost_centre.present? ? cost_centre_names[t.cost_centre] : nil,
          costCentreCode: t.cost_centre.present? ? cost_centre_codes[t.cost_centre] : nil,
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

  # GET /api/v1/tenders/job_documents?job_id=123
  # Returns job documents grouped by document type name for the Tender Builder.
  # Sources document type names from:
  #   1. TenderDocumentTemplate.default_document_types (org-level)
  #   2. Tender.attached_document_types (per-section overrides)
  def job_documents
    job = Job.find(params[:job_id])

    # Collect all configured document type names (union of both sources)
    template = TenderDocumentTemplate.find_by(is_default: true)
    default_types = template&.default_document_types || []
    section_types = Tender.where.not(attached_document_types: []).pluck(:attached_document_types).flatten.uniq
    all_type_names = (default_types + section_types).uniq

    if all_type_names.empty?
      return render json: { success: true, data: [] }
    end

    # Find matching DocumentType records
    doc_types = DocumentType.where(name: all_type_names)
    doc_type_ids = doc_types.pluck(:id)
    doc_type_map = doc_types.index_by(&:id) # id → DocumentType

    # Find WarehouseFolderDocumentType IDs for these doc types
    wfdt_lookup = WarehouseFolderDocumentType
      .where(document_type_id: doc_type_ids)
      .pluck(:id, :document_type_id)
      .to_h # wfdt_id → doc_type_id

    # Query WarehouseDocuments for this job matching those types (all versions)
    documents = WarehouseDocument
      .for_job(job)
      .where(warehouse_folder_document_type_id: wfdt_lookup.keys)
      .includes(:storage_blob)
      .order(:version_group_id, version_number: :desc)

    # Group by document type name, then by version_group for history
    grouped = {}
    documents.each do |doc|
      dt_id = wfdt_lookup[doc.warehouse_folder_document_type_id]
      dt = doc_type_map[dt_id]
      next unless dt

      grouped[dt.name] ||= []
      grouped[dt.name] << {
        id: doc.id,
        name: doc.ui_name || doc.original_filename,
        versionNumber: doc.version_number || 1,
        versionGroupId: doc.version_group_id,
        isLatest: doc.is_latest_version,
        mimeType: doc.storage_blob&.content_type,
        fileSize: doc.storage_blob&.byte_size,
        createdAt: doc.created_at,
        updatedAt: doc.updated_at
      }
    end

    render json: { success: true, data: grouped }
  rescue ActiveRecord::RecordNotFound
    render json: { success: false, error: "Job not found" }, status: :not_found
  end

  # POST /api/v1/tenders/:id/update_document_types
  # Accepts { document_types: ["Plans", "Engineering", ...] }
  def update_document_types
    doc_types = params[:document_types] || []
    @tender.update!(attached_document_types: doc_types)
    render json: { success: true, message: "Document types updated" }
  end

  private

  def set_tender
    @tender = Tender.find(params[:id])
  rescue ActiveRecord::RecordNotFound
    render_error("Tender section not found", status: :not_found)
  end
end
