# frozen_string_literal: true

# CostCentresController - Manages hierarchical cost centres for P&L tracking
#
# Part of Site Presence & Cost Intelligence System
# See: .claude/plans/piped-orbiting-whisper.md
#
class Api::V1::CostCentresController < ApplicationController
  before_action :set_cost_centre, only: [:show, :update, :destroy, :report, :pnl, :assign_po_tasks]

  # GET /api/v1/cost_centres
  def index
    @cost_centres = CostCentre.includes(:parent)
                              .active
                              .order(:sort_order, :name)

    # Filter by type if specified
    @cost_centres = @cost_centres.where(centre_type: params[:type]) if params[:type].present?

    # Filter to root nodes only if requested
    @cost_centres = @cost_centres.roots if params[:roots_only] == "true"

    render json: {
      success: true,
      data: @cost_centres.map { |cc| cost_centre_to_json(cc) }
    }
  end

  # GET /api/v1/cost_centres/tree
  # Returns hierarchical tree structure
  def tree
    roots = CostCentre.roots.active.includes(:children).order(:sort_order, :name)

    render json: {
      success: true,
      data: roots.map { |root| build_tree(root) }
    }
  end

  # GET /api/v1/cost_centres/:id
  def show
    render json: {
      success: true,
      data: cost_centre_to_json(@cost_centre, detailed: true)
    }
  end

  # POST /api/v1/cost_centres
  def create
    @cost_centre = CostCentre.new(cost_centre_params)

    if @cost_centre.save
      render json: {
        success: true,
        data: cost_centre_to_json(@cost_centre)
      }, status: :created
    else
      render json: {
        success: false,
        errors: @cost_centre.errors.full_messages
      }, status: :unprocessable_entity
    end
  end

  # PATCH /api/v1/cost_centres/:id
  def update
    if @cost_centre.update(cost_centre_params)
      render json: {
        success: true,
        data: cost_centre_to_json(@cost_centre)
      }
    else
      render json: {
        success: false,
        errors: @cost_centre.errors.full_messages
      }, status: :unprocessable_entity
    end
  end

  # DELETE /api/v1/cost_centres/:id
  def destroy
    # Check if cost centre has any associated records
    if @cost_centre.labour_cost_entries.exists?
      return render json: {
        success: false,
        error: "Cannot delete cost centre with associated labour cost entries"
      }, status: :unprocessable_entity
    end

    if @cost_centre.children.exists?
      return render json: {
        success: false,
        error: "Cannot delete cost centre with child cost centres"
      }, status: :unprocessable_entity
    end

    if @cost_centre.destroy
      render json: { success: true, message: "Cost centre deleted" }
    else
      render json: {
        success: false,
        errors: @cost_centre.errors.full_messages
      }, status: :unprocessable_entity
    end
  end

  # GET /api/v1/cost_centres/:id/report
  # Basic cost centre report
  def report
    start_date = params[:start_date]&.to_date || 30.days.ago.to_date
    end_date = params[:end_date]&.to_date || Date.current

    entries = @cost_centre.labour_cost_entries.for_date_range(start_date, end_date)

    render json: {
      success: true,
      data: {
        cost_centre: cost_centre_to_json(@cost_centre),
        period: { start_date: start_date, end_date: end_date },
        totals: {
          hours: entries.sum { |e| e.total_hours || 0 }.round(2),
          base_labour: entries.sum(&:base_labour_cost).to_f.round(2),
          employment_cost: entries.sum(&:employment_cost).to_f.round(2),
          overhead: entries.sum(&:overhead_cost).to_f.round(2),
          total_cost: entries.sum(&:total_cost).to_f.round(2),
          entry_count: entries.count
        }
      }
    }
  end

  # GET /api/v1/cost_centres/:id/pnl
  # Detailed P&L report for cost centre
  def pnl
    start_date = params[:start_date]&.to_date || 30.days.ago.to_date
    end_date = params[:end_date]&.to_date || Date.current

    service = LabourCostCalculatorService.new
    pnl_data = service.cost_centre_pnl(
      cost_centre_id: @cost_centre.id,
      start_date: start_date,
      end_date: end_date
    )

    render json: {
      success: true,
      data: pnl_data
    }
  end

  # GET /api/v1/cost_centres/po_tasks
  # Returns all SmScheduleMaster records where po_required=true, with current cost centre assignment
  def po_tasks
    tasks = SmScheduleMaster.where(po_required: true).order(:task_number, :name)

    # Build a lookup of cost centre names for display
    cost_centre_ids = tasks.pluck(:cost_centre).compact.uniq
    cost_centre_names = CostCentre.where(id: cost_centre_ids).pluck(:id, :name).to_h

    render json: {
      success: true,
      data: tasks.map { |t|
        {
          id: t.id,
          name: t.name,
          taskNumber: t.task_number,
          costCentreId: t.cost_centre,
          costCentreName: t.cost_centre.present? ? cost_centre_names[t.cost_centre] : nil
        }
      }
    }
  end

  # POST /api/v1/cost_centres/:id/assign_po_tasks
  # Accepts { po_task_ids: [1, 2, 3] } and updates SmScheduleMaster.cost_centre
  def assign_po_tasks
    po_task_ids = params[:po_task_ids] || []

    ActiveRecord::Base.transaction do
      # Clear tasks previously assigned to this cost centre but no longer in the list
      SmScheduleMaster.where(cost_centre: @cost_centre.id)
                      .where.not(id: po_task_ids)
                      .update_all(cost_centre: nil)

      # Assign the specified tasks to this cost centre
      if po_task_ids.present?
        SmScheduleMaster.where(id: po_task_ids)
                        .update_all(cost_centre: @cost_centre.id)
      end
    end

    render json: { success: true, message: "PO tasks updated" }
  end

  private

  def set_cost_centre
    @cost_centre = CostCentre.find(params[:id])
  rescue ActiveRecord::RecordNotFound
    render json: { success: false, error: "Cost centre not found" }, status: :not_found
  end

  def cost_centre_params
    params.require(:cost_centre).permit(
      :code,
      :name,
      :description,
      :centre_type,
      :parent_id,
      :overhead_allocation_percent,
      :employment_cost_allocation_percent,
      :budget_amount,
      :budget_period,
      :sort_order,
      :active,
      :gl_code
    )
  end

  def cost_centre_to_json(cc, detailed: false)
    json = {
      id: cc.id,
      code: cc.code,
      name: cc.name,
      full_code: cc.full_code,
      centre_type: cc.centre_type,
      parent_id: cc.parent_id,
      depth: cc.depth,
      overhead_percent: cc.overhead_allocation_percent&.to_f || 0,
      total_overhead_percent: cc.total_overhead_percent,
      active: cc.active
    }

    # Parent info
    if cc.parent
      json[:parent] = {
        id: cc.parent.id,
        code: cc.parent.code,
        name: cc.parent.name
      }
    end

    # Detailed view
    if detailed
      json.merge!(
        description: cc.description,
        employment_cost_allocation_percent: cc.employment_cost_allocation_percent&.to_f,
        budget_amount: cc.budget_amount&.to_f,
        budget_period: cc.budget_period,
        gl_code: cc.gl_code,
        sort_order: cc.sort_order,
        created_at: cc.created_at,
        updated_at: cc.updated_at,
        children_count: cc.children.count,
        worker_profiles_count: cc.worker_profiles.count,
        labour_entries_count: cc.labour_cost_entries.count
      )

      # Get P&L summary for current period
      current_month_start = Date.current.beginning_of_month
      current_entries = cc.labour_cost_entries.for_date_range(current_month_start, Date.current)
      json[:current_month] = {
        hours: current_entries.sum { |e| e.total_hours || 0 }.round(2),
        total_cost: current_entries.sum(&:total_cost).to_f.round(2)
      }
    end

    json
  end

  def build_tree(cc)
    node = cost_centre_to_json(cc)
    children = cc.children.active.order(:sort_order, :name)

    if children.any?
      node[:children] = children.map { |child| build_tree(child) }
    else
      node[:children] = []
    end

    node
  end
end
