# frozen_string_literal: true

# ProfitCentreReportService - Generates P&L report by profit centre
#
# Aggregates: revenue (job_claims + progress claim lines) vs costs (PO line items)
# per profit centre, optionally filtered by job and date range.
#
class ProfitCentreReportService
  def initialize(job_id: nil, start_date: nil, end_date: nil)
    @job_id = job_id
    @start_date = start_date || 12.months.ago.to_date
    @end_date = end_date || Date.current
  end

  def generate
    {
      period: { startDate: @start_date, endDate: @end_date },
      jobId: @job_id,
      profitCentres: build_profit_centre_data,
      totals: build_totals
    }
  end

  private

  def build_profit_centre_data
    profit_centres = scoped_profit_centres
    pc_ids = profit_centres.pluck(:id)

    costs_by_pc = costs_grouped_by_profit_centre(pc_ids)
    claim_revenue_by_pc = claim_revenue_grouped_by_profit_centre(pc_ids)
    progress_revenue_by_pc = progress_revenue_grouped_by_profit_centre(pc_ids)

    result = profit_centres.map do |pc|
      costs = costs_by_pc[pc.id] || 0.0
      claim_rev = claim_revenue_by_pc[pc.id] || 0.0
      progress_rev = progress_revenue_by_pc[pc.id] || 0.0
      revenue = claim_rev + progress_rev
      profit = revenue - costs
      margin = revenue.positive? ? ((profit / revenue) * 100).round(2) : 0.0

      {
        id: pc.id,
        code: pc.code,
        name: pc.name,
        centreType: pc.centre_type,
        jobId: pc.job_id,
        budgetAmount: pc.budget_amount&.to_f,
        revenue: revenue.round(2),
        claimRevenue: claim_rev.round(2),
        progressRevenue: progress_rev.round(2),
        costs: costs.round(2),
        profit: profit.round(2),
        marginPct: margin
      }
    end

    # Add "Unassigned" row for records without a profit centre
    unassigned_costs = unassigned_costs_total
    unassigned_claim_rev = unassigned_claim_revenue_total
    unassigned_progress_rev = unassigned_progress_revenue_total
    unassigned_revenue = unassigned_claim_rev + unassigned_progress_rev
    unassigned_profit = unassigned_revenue - unassigned_costs

    if unassigned_costs.positive? || unassigned_revenue.positive?
      result << {
        id: nil,
        code: "UNASSIGNED",
        name: "Unassigned",
        centreType: nil,
        jobId: nil,
        budgetAmount: nil,
        revenue: unassigned_revenue.round(2),
        claimRevenue: unassigned_claim_rev.round(2),
        progressRevenue: unassigned_progress_rev.round(2),
        costs: unassigned_costs.round(2),
        profit: unassigned_profit.round(2),
        marginPct: unassigned_revenue.positive? ? ((unassigned_profit / unassigned_revenue) * 100).round(2) : 0.0
      }
    end

    result
  end

  def build_totals
    all_data = build_profit_centre_data
    {
      revenue: all_data.sum { |d| d[:revenue] }.round(2),
      costs: all_data.sum { |d| d[:costs] }.round(2),
      profit: all_data.sum { |d| d[:profit] }.round(2)
    }
  end

  def scoped_profit_centres
    scope = ProfitCentre.active.ordered
    scope = scope.for_job(@job_id) if @job_id.present?
    scope
  end

  # Costs from PO line items
  def costs_grouped_by_profit_centre(pc_ids)
    scope = PurchaseOrderLineItem.where(profit_centre_id: pc_ids)
                                  .joins(:purchase_order)

    if @job_id.present?
      scope = scope.where(purchase_orders: { job_id: @job_id })
    end

    scope.group(:profit_centre_id)
         .sum(:total_amount)
         .transform_values(&:to_f)
  end

  # Revenue from job claims (header-level)
  def claim_revenue_grouped_by_profit_centre(pc_ids)
    scope = JobClaim.where(profit_centre_id: pc_ids)

    if @job_id.present?
      scope = scope.where(job_id: @job_id)
    end

    scope.group(:profit_centre_id)
         .sum(:amount)
         .transform_values(&:to_f)
  end

  # Revenue from GL progress claim lines
  # Note: unscope(:order) required because Gl::ProgressClaimLine has default_scope { order(:sort_order) }
  def progress_revenue_grouped_by_profit_centre(pc_ids)
    scope = Gl::ProgressClaimLine.unscope(:order).where(profit_centre_id: pc_ids)

    if @job_id.present?
      scope = scope.joins(:progress_claim)
                   .where(gl_progress_claims: { job_id: @job_id })
    end

    scope.group(:profit_centre_id)
         .sum(:this_claim_amount)
         .transform_values(&:to_f)
  end

  # Unassigned totals (NULL profit_centre_id)
  def unassigned_costs_total
    scope = PurchaseOrderLineItem.where(profit_centre_id: nil)
    if @job_id.present?
      scope = scope.joins(:purchase_order).where(purchase_orders: { job_id: @job_id })
    end
    scope.sum(:total_amount).to_f
  end

  def unassigned_claim_revenue_total
    scope = JobClaim.where(profit_centre_id: nil)
    scope = scope.where(job_id: @job_id) if @job_id.present?
    scope.sum(:amount).to_f
  end

  def unassigned_progress_revenue_total
    scope = Gl::ProgressClaimLine.unscope(:order).where(profit_centre_id: nil)
    if @job_id.present?
      scope = scope.joins(:progress_claim).where(gl_progress_claims: { job_id: @job_id })
    end
    scope.sum(:this_claim_amount).to_f
  end
end
