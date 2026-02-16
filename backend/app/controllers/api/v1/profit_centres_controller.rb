# frozen_string_literal: true

# ProfitCentresController - Manages profit centres for revenue/cost tracking by business segment
#
# Profit centres enable P&L tracking per job segment (Design, Base Contract, Variations).
# Global templates (is_template: true) are available to all jobs.
# Job-specific profit centres track variations (Variation 1, Variation 2, etc.).
#
class Api::V1::ProfitCentresController < ApplicationController
  before_action :set_profit_centre, only: [:show, :update, :destroy]

  # GET /api/v1/profit_centres
  # Params: job_id (optional), templates_only (optional)
  def index
    @profit_centres = ProfitCentre.active.ordered

    if params[:templates_only] == "true"
      @profit_centres = @profit_centres.templates
    elsif params[:job_id].present?
      # Return both global templates and job-specific profit centres
      @profit_centres = @profit_centres.for_job(params[:job_id])
    end

    if params[:centre_type].present?
      @profit_centres = @profit_centres.where(centre_type: params[:centre_type])
    end

    render json: {
      success: true,
      data: @profit_centres.map { |pc| profit_centre_to_json(pc) }
    }
  end

  # GET /api/v1/profit_centres/:id
  def show
    render json: {
      success: true,
      data: profit_centre_to_json(@profit_centre, detailed: true)
    }
  end

  # POST /api/v1/profit_centres
  def create
    @profit_centre = ProfitCentre.new(profit_centre_params)

    if @profit_centre.save
      render json: {
        success: true,
        data: profit_centre_to_json(@profit_centre)
      }, status: :created
    else
      render_validation_errors(@profit_centre)
    end
  end

  # PATCH /api/v1/profit_centres/:id
  def update
    if @profit_centre.update(profit_centre_params)
      render json: {
        success: true,
        data: profit_centre_to_json(@profit_centre)
      }
    else
      render_validation_errors(@profit_centre)
    end
  end

  # DELETE /api/v1/profit_centres/:id
  def destroy
    # Check for associated records
    if @profit_centre.purchase_order_line_items.exists?
      return render_error("Cannot delete profit centre with associated PO line items", status: :unprocessable_entity)
    end

    if @profit_centre.progress_claim_lines.exists?
      return render_error("Cannot delete profit centre with associated claim lines", status: :unprocessable_entity)
    end

    if @profit_centre.job_claims.exists?
      return render_error("Cannot delete profit centre with associated job claims", status: :unprocessable_entity)
    end

    if @profit_centre.destroy
      render json: { success: true, message: "Profit centre deleted" }
    else
      render_validation_errors(@profit_centre)
    end
  end

  # POST /api/v1/profit_centres/create_variation
  # Auto-numbers a new variation for a job (VAR-001, VAR-002, etc.)
  # Params: job_id (required)
  def create_variation
    job = Job.find(params[:job_id])

    service = ProfitCentreVariationService.new(job)
    @profit_centre = service.create!

    render json: {
      success: true,
      data: profit_centre_to_json(@profit_centre)
    }, status: :created
  rescue ActiveRecord::RecordNotFound
    render_error("Job not found", status: :not_found)
  rescue => e
    render_error(e.message, status: :unprocessable_entity)
  end

  # GET /api/v1/profit_centres/report
  # Revenue vs costs by profit centre
  # Params: job_id (optional), start_date, end_date
  def report
    service = ProfitCentreReportService.new(
      job_id: params[:job_id],
      start_date: params[:start_date]&.to_date,
      end_date: params[:end_date]&.to_date
    )

    render json: {
      success: true,
      data: service.generate
    }
  rescue => e
    render_error(e.message, status: :unprocessable_entity)
  end

  private

  def set_profit_centre
    @profit_centre = ProfitCentre.find(params[:id])
  rescue ActiveRecord::RecordNotFound
    render_error("Profit centre not found", status: :not_found)
  end

  def profit_centre_params
    params.require(:profit_centre).permit(
      :code,
      :name,
      :description,
      :centre_type,
      :job_id,
      :is_template,
      :active,
      :sort_order,
      :budget_amount
    )
  end

  def profit_centre_to_json(pc, detailed: false)
    json = {
      id: pc.id,
      code: pc.code,
      name: pc.name,
      displayLabel: pc.display_label,
      centreType: pc.centre_type,
      jobId: pc.job_id,
      isTemplate: pc.is_template,
      active: pc.active,
      sortOrder: pc.sort_order,
      budgetAmount: pc.budget_amount&.to_f
    }

    if detailed
      json.merge!(
        description: pc.description,
        metadata: pc.metadata,
        createdAt: pc.created_at,
        updatedAt: pc.updated_at,
        poLineItemsCount: pc.purchase_order_line_items.count,
        claimLinesCount: pc.progress_claim_lines.count,
        jobClaimsCount: pc.job_claims.count
      )

      if pc.job.present?
        json[:job] = {
          id: pc.job.id,
          name: pc.job.name,
          jobCode: pc.job.job_code
        }
      end
    end

    json
  end
end
