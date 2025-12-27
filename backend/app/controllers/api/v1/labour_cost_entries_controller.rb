# frozen_string_literal: true

# LabourCostEntriesController - Manages simPRO-style labour cost entries
#
# Part of Site Presence & Cost Intelligence System
# See: .claude/plans/piped-orbiting-whisper.md
#
class Api::V1::LabourCostEntriesController < ApplicationController
  before_action :set_entry, only: [:show, :update, :mark_billed, :write_off]

  # GET /api/v1/labour_cost_entries
  def index
    @entries = LabourCostEntry.includes(:worker_profile, :job, :cost_centre)
                              .recent

    # Date range filter
    if params[:start_date].present? && params[:end_date].present?
      @entries = @entries.for_date_range(params[:start_date].to_date, params[:end_date].to_date)
    elsif params[:date].present?
      @entries = @entries.for_date(params[:date].to_date)
    end

    # Job filter
    @entries = @entries.for_job(params[:job_id]) if params[:job_id].present?

    # Worker filter
    @entries = @entries.for_worker(params[:worker_profile_id]) if params[:worker_profile_id].present?

    # Cost centre filter
    @entries = @entries.for_cost_centre(params[:cost_centre_id]) if params[:cost_centre_id].present?

    # Billing status filter
    @entries = @entries.where(billing_status: params[:billing_status]) if params[:billing_status].present?

    # Source filter
    @entries = @entries.where(entry_source: params[:entry_source]) if params[:entry_source].present?

    # Limit results
    limit = [params[:limit]&.to_i || 100, 1000].min
    @entries = @entries.limit(limit)

    render json: {
      success: true,
      data: @entries.map { |e| entry_to_json(e) },
      meta: {
        count: @entries.length,
        total_hours: @entries.sum { |e| e.total_hours || 0 }.round(2),
        total_cost: @entries.sum(&:total_cost).to_f.round(2)
      }
    }
  end

  # GET /api/v1/labour_cost_entries/for_job
  def for_job
    return render json: { success: false, error: "job_id is required" }, status: :bad_request unless params[:job_id].present?

    service = LabourCostCalculatorService.new
    summary = service.job_cost_summary(
      job_id: params[:job_id],
      start_date: params[:start_date]&.to_date,
      end_date: params[:end_date]&.to_date
    )

    render json: { success: true, data: summary }
  end

  # GET /api/v1/labour_cost_entries/for_worker
  def for_worker
    return render json: { success: false, error: "worker_profile_id is required" }, status: :bad_request unless params[:worker_profile_id].present?

    start_date = params[:start_date]&.to_date || 30.days.ago.to_date
    end_date = params[:end_date]&.to_date || Date.current

    service = LabourCostCalculatorService.new
    report = service.worker_productivity_report(
      worker_profile_id: params[:worker_profile_id],
      start_date: start_date,
      end_date: end_date
    )

    render json: { success: true, data: report }
  end

  # GET /api/v1/labour_cost_entries/unbilled
  def unbilled
    @entries = LabourCostEntry.includes(:worker_profile, :job, :cost_centre)
                              .ready_to_bill
                              .recent

    # Job filter
    @entries = @entries.for_job(params[:job_id]) if params[:job_id].present?

    # Date range
    if params[:start_date].present? && params[:end_date].present?
      @entries = @entries.for_date_range(params[:start_date].to_date, params[:end_date].to_date)
    end

    render json: {
      success: true,
      data: @entries.map { |e| entry_to_json(e) },
      meta: {
        count: @entries.length,
        total_billable: @entries.sum { |e| e.billable_amount || e.total_cost || 0 }.round(2)
      }
    }
  end

  # GET /api/v1/labour_cost_entries/:id
  def show
    render json: {
      success: true,
      data: entry_to_json(@entry, detailed: true)
    }
  end

  # POST /api/v1/labour_cost_entries
  # Create manual labour cost entry
  def create
    @entry = LabourCostEntry.new(entry_params)
    @entry.entry_source = "manual"

    if @entry.save
      render json: {
        success: true,
        data: entry_to_json(@entry)
      }, status: :created
    else
      render json: {
        success: false,
        errors: @entry.errors.full_messages
      }, status: :unprocessable_entity
    end
  end

  # PATCH /api/v1/labour_cost_entries/:id
  def update
    # Don't allow updating invoiced entries
    if @entry.billing_status == "invoiced"
      return render json: {
        success: false,
        error: "Cannot update invoiced entries"
      }, status: :unprocessable_entity
    end

    if @entry.update(entry_params)
      render json: {
        success: true,
        data: entry_to_json(@entry)
      }
    else
      render json: {
        success: false,
        errors: @entry.errors.full_messages
      }, status: :unprocessable_entity
    end
  end

  # POST /api/v1/labour_cost_entries/:id/mark_billed
  def mark_billed
    invoice_id = params[:invoice_id]
    return render json: { success: false, error: "invoice_id is required" }, status: :bad_request unless invoice_id.present?

    invoice = Invoice.find_by(id: invoice_id)
    return render json: { success: false, error: "Invoice not found" }, status: :not_found unless invoice

    @entry.mark_billed!(invoice)

    render json: {
      success: true,
      data: entry_to_json(@entry),
      message: "Entry marked as billed"
    }
  rescue StandardError => e
    render json: { success: false, error: e.message }, status: :unprocessable_entity
  end

  # POST /api/v1/labour_cost_entries/bulk_mark_billed
  def bulk_mark_billed
    entry_ids = params[:entry_ids]
    invoice_id = params[:invoice_id]

    return render json: { success: false, error: "entry_ids and invoice_id are required" }, status: :bad_request unless entry_ids.present? && invoice_id.present?

    invoice = Invoice.find_by(id: invoice_id)
    return render json: { success: false, error: "Invoice not found" }, status: :not_found unless invoice

    updated_count = 0
    LabourCostEntry.where(id: entry_ids).find_each do |entry|
      entry.mark_billed!(invoice)
      updated_count += 1
    rescue StandardError
      # Skip entries that can't be updated
    end

    render json: {
      success: true,
      updated_count: updated_count,
      message: "#{updated_count} entries marked as billed"
    }
  end

  # POST /api/v1/labour_cost_entries/:id/write_off
  def write_off
    reason = params[:reason] || "Written off by #{current_user&.name || 'system'}"

    @entry.write_off!(reason: reason)

    render json: {
      success: true,
      data: entry_to_json(@entry),
      message: "Entry written off"
    }
  rescue StandardError => e
    render json: { success: false, error: e.message }, status: :unprocessable_entity
  end

  private

  def set_entry
    @entry = LabourCostEntry.find(params[:id])
  rescue ActiveRecord::RecordNotFound
    render json: { success: false, error: "Labour cost entry not found" }, status: :not_found
  end

  def entry_params
    params.require(:labour_cost_entry).permit(
      :worker_profile_id,
      :job_id,
      :sm_task_id,
      :cost_centre_id,
      :entry_date,
      :regular_hours,
      :overtime_1_5x_hours,
      :overtime_2x_hours,
      :travel_hours,
      :standby_hours,
      :base_rate,
      :billable,
      :billable_rate,
      :billable_amount,
      :description,
      :internal_notes
    )
  end

  def entry_to_json(entry, detailed: false)
    json = {
      id: entry.id,
      entry_date: entry.entry_date,
      entry_source: entry.entry_source,
      billing_status: entry.billing_status,
      billable: entry.billable
    }

    # Hours
    json[:hours] = {
      regular: entry.regular_hours&.to_f || 0,
      overtime_1_5x: entry.overtime_1_5x_hours&.to_f || 0,
      overtime_2x: entry.overtime_2x_hours&.to_f || 0,
      travel: entry.travel_hours&.to_f || 0,
      standby: entry.standby_hours&.to_f || 0,
      total: entry.total_hours
    }

    # Costs
    json[:costs] = {
      base_labour: entry.base_labour_cost&.to_f || 0,
      employment: entry.employment_cost&.to_f || 0,
      overhead: entry.overhead_cost&.to_f || 0,
      total: entry.total_cost&.to_f || 0
    }

    # Rates used
    json[:rates] = {
      base: entry.base_rate&.to_f,
      overtime_1_5x: entry.overtime_1_5x_rate&.to_f,
      overtime_2x: entry.overtime_2x_rate&.to_f,
      employment_percent: entry.employment_cost_percent_used&.to_f,
      overhead_percent: entry.overhead_percent_used&.to_f
    }

    # Relationships
    if entry.worker_profile
      json[:worker] = {
        id: entry.worker_profile.id,
        name: entry.worker_profile.display_name,
        type: entry.worker_profile.worker_type
      }
    end

    if entry.job
      json[:job] = {
        id: entry.job.id,
        name: entry.job.name,
        number: entry.job.job_number
      }
    end

    if entry.cost_centre
      json[:cost_centre] = {
        id: entry.cost_centre.id,
        code: entry.cost_centre.code,
        name: entry.cost_centre.name
      }
    end

    # Detailed view
    if detailed
      json.merge!(
        site_presence_session_id: entry.site_presence_session_id,
        sm_task_id: entry.sm_task_id,
        invoice_id: entry.invoice_id,
        billable_rate: entry.billable_rate&.to_f,
        billable_amount: entry.billable_amount&.to_f,
        description: entry.description,
        internal_notes: entry.internal_notes,
        created_at: entry.created_at,
        updated_at: entry.updated_at
      )

      # Cost breakdown
      json[:cost_breakdown] = entry.cost_breakdown
    end

    json
  end
end
