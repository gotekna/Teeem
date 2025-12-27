# frozen_string_literal: true

# JobCostBudgetsController - Manages job cost budgets and alerts
#
# Part of Site Presence & Cost Intelligence System
# See: .claude/plans/piped-orbiting-whisper.md
#
class Api::V1::JobCostBudgetsController < ApplicationController
  before_action :set_budget, only: [:show, :update, :recalculate]

  # GET /api/v1/job_cost_budgets
  def index
    @budgets = JobCostBudget.includes(:job)
                            .order(created_at: :desc)

    # Filter by job if specified
    @budgets = @budgets.where(job_id: params[:job_id]) if params[:job_id].present?

    # Filter by alert status
    @budgets = @budgets.over_warning if params[:status] == "warning"
    @budgets = @budgets.over_critical if params[:status] == "critical"
    @budgets = @budgets.over_budget if params[:status] == "over_budget"

    # Limit results
    limit = [params[:limit]&.to_i || 50, 200].min
    @budgets = @budgets.limit(limit)

    render json: {
      success: true,
      data: @budgets.map { |b| budget_to_json(b) }
    }
  end

  # GET /api/v1/job_cost_budgets/alerts
  # Returns jobs that need attention
  def alerts
    warning_budgets = JobCostBudget.over_warning.includes(:job).limit(20)
    critical_budgets = JobCostBudget.over_critical.includes(:job).limit(20)

    render json: {
      success: true,
      data: {
        critical: critical_budgets.map { |b| alert_to_json(b, "critical") },
        warning: warning_budgets.map { |b| alert_to_json(b, "warning") },
        summary: {
          critical_count: JobCostBudget.over_critical.count,
          warning_count: JobCostBudget.over_warning.count,
          total_monitored: JobCostBudget.count
        }
      }
    }
  end

  # GET /api/v1/job_cost_budgets/over_budget
  def over_budget
    @budgets = JobCostBudget.over_budget.includes(:job).order(:labour_variance_percent)

    render json: {
      success: true,
      data: @budgets.map { |b| budget_to_json(b, include_variance: true) }
    }
  end

  # GET /api/v1/job_cost_budgets/:id
  def show
    render json: {
      success: true,
      data: budget_to_json(@budget, detailed: true)
    }
  end

  # POST /api/v1/job_cost_budgets
  def create
    @budget = JobCostBudget.new(budget_params)

    # Set default thresholds if not provided
    @budget.warning_threshold_percent ||= 80
    @budget.critical_threshold_percent ||= 100

    if @budget.save
      render json: {
        success: true,
        data: budget_to_json(@budget)
      }, status: :created
    else
      render json: {
        success: false,
        errors: @budget.errors.full_messages
      }, status: :unprocessable_entity
    end
  end

  # PATCH /api/v1/job_cost_budgets/:id
  def update
    if @budget.update(budget_params)
      render json: {
        success: true,
        data: budget_to_json(@budget)
      }
    else
      render json: {
        success: false,
        errors: @budget.errors.full_messages
      }, status: :unprocessable_entity
    end
  end

  # POST /api/v1/job_cost_budgets/:id/recalculate
  def recalculate
    @budget.recalculate!

    render json: {
      success: true,
      data: budget_to_json(@budget, detailed: true),
      message: "Budget recalculated successfully"
    }
  rescue StandardError => e
    render json: {
      success: false,
      error: "Recalculation failed: #{e.message}"
    }, status: :unprocessable_entity
  end

  private

  def set_budget
    @budget = JobCostBudget.find(params[:id])
  rescue ActiveRecord::RecordNotFound
    render json: { success: false, error: "Budget not found" }, status: :not_found
  end

  def budget_params
    params.require(:job_cost_budget).permit(
      :job_id,
      :labour_budget,
      :materials_budget,
      :subcontractor_budget,
      :equipment_budget,
      :other_budget,
      :contingency_percent,
      :warning_threshold_percent,
      :critical_threshold_percent,
      :notes
    )
  end

  def budget_to_json(budget, detailed: false, include_variance: false)
    json = {
      id: budget.id,
      job_id: budget.job_id,
      job_name: budget.job&.name,
      job_number: budget.job&.job_number,
      total_budget: budget.total_budget&.to_f || 0,
      total_actual: budget.total_actual&.to_f || 0,
      total_variance_percent: budget.total_variance_percent,
      status: budget.status
    }

    # Budget breakdown
    json[:budgets] = {
      labour: budget.labour_budget&.to_f || 0,
      materials: budget.materials_budget&.to_f || 0,
      subcontractor: budget.subcontractor_budget&.to_f || 0,
      equipment: budget.equipment_budget&.to_f || 0,
      other: budget.other_budget&.to_f || 0,
      contingency_percent: budget.contingency_percent&.to_f || 0
    }

    # Actual costs
    json[:actuals] = {
      labour: budget.labour_actual&.to_f || 0,
      materials: budget.materials_actual&.to_f || 0,
      subcontractor: budget.subcontractor_actual&.to_f || 0,
      equipment: budget.equipment_actual&.to_f || 0,
      other: budget.other_actual&.to_f || 0
    }

    # Thresholds
    json[:thresholds] = {
      warning: budget.warning_threshold_percent,
      critical: budget.critical_threshold_percent
    }

    # Alert status
    json[:alerts] = {
      over_warning: budget.over_warning_threshold?,
      over_critical: budget.over_critical_threshold?,
      over_budget: budget.over_budget?
    }

    if include_variance || detailed
      json[:variance] = {
        labour: budget.labour_variance_percent,
        materials: budget.materials_variance_percent,
        subcontractor: budget.subcontractor_variance_percent,
        total: budget.total_variance_percent
      }
    end

    if detailed
      json.merge!(
        notes: budget.notes,
        created_at: budget.created_at,
        updated_at: budget.updated_at,
        last_calculated_at: budget.last_calculated_at
      )

      # Remaining budget
      json[:remaining] = {
        labour: [(budget.labour_budget || 0) - (budget.labour_actual || 0), 0].max,
        materials: [(budget.materials_budget || 0) - (budget.materials_actual || 0), 0].max,
        subcontractor: [(budget.subcontractor_budget || 0) - (budget.subcontractor_actual || 0), 0].max,
        total: [(budget.total_budget || 0) - (budget.total_actual || 0), 0].max
      }
    end

    json
  end

  def alert_to_json(budget, severity)
    {
      id: budget.id,
      job_id: budget.job_id,
      job_name: budget.job&.name,
      job_number: budget.job&.job_number,
      severity: severity,
      variance_percent: budget.total_variance_percent,
      budget: budget.total_budget&.to_f || 0,
      actual: budget.total_actual&.to_f || 0,
      over_by: [(budget.total_actual || 0) - (budget.total_budget || 0), 0].max.to_f.round(2)
    }
  end
end
