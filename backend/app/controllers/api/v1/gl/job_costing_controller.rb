# frozen_string_literal: true

module Api
  module V1
    module Gl
      class JobCostingController < ApplicationController
        before_action :set_job, only: %i[
          show summary costs transactions
          profit_loss budget_comparison
          monthly_trend wip
        ]

        # GET /api/v1/gl/job_costing
        # List all jobs with basic profitability info
        def index
          jobs = find_jobs
          as_at = parse_date(params[:as_at_date])

          data = ::Gl::JobCostingService.compare_jobs(jobs, as_at_date: as_at)

          render json: {
            success: true,
            data: data,
            as_at_date: as_at
          }
        end

        # GET /api/v1/gl/job_costing/:job_id
        # Get complete job costing summary
        def show
          as_at = parse_date(params[:as_at_date])
          service = ::Gl::JobCostingService.new(@job)

          render json: {
            success: true,
            data: service.summary(as_at_date: as_at)
          }
        end

        # GET /api/v1/gl/job_costing/:job_id/summary
        def summary
          as_at = parse_date(params[:as_at_date])
          service = ::Gl::JobCostingService.new(@job)

          render json: {
            success: true,
            data: service.summary(as_at_date: as_at)
          }
        end

        # GET /api/v1/gl/job_costing/:job_id/costs
        # Get detailed cost breakdown
        def costs
          as_at = parse_date(params[:as_at_date])
          service = ::Gl::JobCostingService.new(@job)

          render json: {
            success: true,
            data: {
              summary: service.costs_summary(as_at),
              by_account: service.costs_by_account(as_at)
            }
          }
        end

        # GET /api/v1/gl/job_costing/:job_id/transactions
        # Get all financial transactions for the job
        def transactions
          from_date = params[:from_date].present? ? Date.parse(params[:from_date]) : nil
          to_date = parse_date(params[:to_date])
          type = params[:type] # 'revenue', 'cost', or nil for all

          service = ::Gl::JobCostingService.new(@job)
          transactions = service.transactions(
            from_date: from_date,
            to_date: to_date,
            type: type
          )

          render json: {
            success: true,
            data: transactions,
            count: transactions.length
          }
        end

        # GET /api/v1/gl/job_costing/:job_id/profit_loss
        # Get P&L statement for the job
        def profit_loss
          as_at = parse_date(params[:as_at_date])
          report = ::Gl::Reports::JobProfitability.new(current_company)

          render json: {
            success: true,
            data: report.for_job(@job, as_at_date: as_at)
          }
        end

        # GET /api/v1/gl/job_costing/:job_id/budget_comparison
        # Get budget vs actual comparison
        def budget_comparison
          as_at = parse_date(params[:as_at_date])
          service = ::Gl::JobCostingService.new(@job)

          render json: {
            success: true,
            data: service.budget_comparison(as_at)
          }
        end

        # GET /api/v1/gl/job_costing/:job_id/monthly_trend
        # Get monthly profitability trend
        def monthly_trend
          months = (params[:months] || 12).to_i
          report = ::Gl::Reports::JobProfitability.new(current_company)

          render json: {
            success: true,
            data: report.monthly_trend(@job, months: months)
          }
        end

        # GET /api/v1/gl/job_costing/:job_id/wip
        # Get WIP (Work in Progress) value
        def wip
          as_at = parse_date(params[:as_at_date])
          service = ::Gl::JobCostingService.new(@job)

          render json: {
            success: true,
            data: service.wip_value(as_at)
          }
        end

        # ═══════════════════════════════════════════════════════════════
        # MULTI-JOB REPORTS
        # ═══════════════════════════════════════════════════════════════

        # GET /api/v1/gl/job_costing/compare
        # Compare multiple jobs
        def compare
          job_ids = params[:job_ids]&.split(',')&.map(&:to_i) || []
          jobs = Job.where(id: job_ids)

          return render json: { success: false, error: 'No jobs specified' }, status: :bad_request if jobs.empty?

          as_at = parse_date(params[:as_at_date])
          report = ::Gl::Reports::JobProfitability.new(current_company)

          render json: {
            success: true,
            data: report.compare(jobs, as_at_date: as_at)
          }
        end

        # GET /api/v1/gl/job_costing/summary
        # Summary of all active jobs
        def all_jobs_summary
          as_at = parse_date(params[:as_at_date])
          report = ::Gl::Reports::JobProfitability.new(current_company)

          render json: {
            success: true,
            data: report.all_jobs_summary(as_at_date: as_at)
          }
        end

        # GET /api/v1/gl/job_costing/cost_categories
        # Cost breakdown by category across jobs
        def cost_categories
          as_at = parse_date(params[:as_at_date])
          job_ids = params[:job_ids]&.split(',')&.map(&:to_i)
          jobs = job_ids.present? ? Job.where(id: job_ids) : nil

          report = ::Gl::Reports::JobProfitability.new(current_company)

          render json: {
            success: true,
            data: report.cost_category_analysis(jobs, as_at_date: as_at)
          }
        end

        # GET /api/v1/gl/job_costing/budget_variance
        # Budget variance report for all jobs
        def budget_variance
          as_at = parse_date(params[:as_at_date])
          job_ids = params[:job_ids]&.split(',')&.map(&:to_i)
          jobs = job_ids.present? ? Job.where(id: job_ids) : nil

          report = ::Gl::Reports::JobProfitability.new(current_company)

          render json: {
            success: true,
            data: report.budget_variance_report(jobs, as_at_date: as_at)
          }
        end

        # GET /api/v1/gl/job_costing/wip_report
        # WIP report for all jobs
        def wip_report
          as_at = parse_date(params[:as_at_date])
          report = ::Gl::Reports::JobProfitability.new(current_company)

          render json: {
            success: true,
            data: report.wip_report(as_at_date: as_at)
          }
        end

        # GET /api/v1/gl/job_costing/rankings
        # Top/bottom performing jobs
        def rankings
          as_at = parse_date(params[:as_at_date])
          limit = (params[:limit] || 10).to_i

          report = ::Gl::Reports::JobProfitability.new(current_company)
          all_data = report.all_jobs_summary(as_at_date: as_at)

          render json: {
            success: true,
            data: {
              rankings: all_data[:rankings],
              totals: all_data[:totals]
            }
          }
        end

        private

        def set_job
          @job = Job.find(params[:job_id] || params[:id])
        end

        def find_jobs
          jobs = Job.all

          # Filter by status
          if params[:status].present?
            jobs = jobs.joins(:job_status).where(job_statuses: { name: params[:status] })
          end

          # Filter active only (not archived)
          jobs = jobs.where(archived_at: nil) unless params[:include_archived] == 'true'

          # Filter by type
          if params[:job_type].present?
            jobs = jobs.joins(:job_type).where(job_types: { name: params[:job_type] })
          end

          # Sort
          case params[:sort]
          when 'name'
            jobs = jobs.order(:name)
          when 'contract_value'
            jobs = jobs.order(contract_value: :desc)
          when 'start_date'
            jobs = jobs.order(start_date: :desc)
          else
            jobs = jobs.order(:name)
          end

          # Limit
          limit = (params[:limit] || 100).to_i
          jobs.limit(limit)
        end

        def parse_date(value, default: Date.current)
          return default if value.blank?
          Date.parse(value.to_s)
        rescue ArgumentError
          default
        end

        def current_company
          @current_company ||= Corporate.find(params[:corporate_id] || current_user&.corporate_id || 1)
        end
      end
    end
  end
end
