# frozen_string_literal: true

module Api
  module V1
    module Gl
      # Controller for Construction Work in Progress (WIP) reports
      # Tracks revenue recognition using percentage of completion method
      class WipReportsController < ApplicationController
        before_action :set_corporate
        before_action :set_wip_report, only: [:show, :update, :destroy, :recalculate, :finalize, :archive]

        # GET /api/v1/gl/wip_reports
        def index
          reports = @corporate.gl_wip_reports
                                      .includes(:jobs, :created_by)
                                      .order(report_date: :desc)

          reports = reports.where(status: params[:status]) if params[:status].present?

          render json: { success: true, data: reports.as_json(include: [:created_by]) }
        end

        # GET /api/v1/gl/wip_reports/:id
        def show
          render json: {
            success: true,
            data: @wip_report.as_json(
              include: {
                jobs: {
                  include: :job
                },
                created_by: { only: [:id, :name, :email] }
              }
            )
          }
        end

        # POST /api/v1/gl/wip_reports
        def create
          @wip_report = ::Gl::WipReport.generate!(
            @corporate,
            as_of: Date.parse(params[:report_date] || Date.current.to_s),
            user: current_user
          )

          render json: { success: true, data: @wip_report }, status: :created
        rescue StandardError => e
          render json: { success: false, error: e.message }, status: :unprocessable_entity
        end

        # PATCH/PUT /api/v1/gl/wip_reports/:id
        def update
          if @wip_report.update(wip_report_params)
            render json: { success: true, data: @wip_report }
          else
            render json: { success: false, error: @wip_report.errors.full_messages.join(", ") },
                   status: :unprocessable_entity
          end
        end

        # DELETE /api/v1/gl/wip_reports/:id
        def destroy
          if @wip_report.status == "final"
            render json: { success: false, error: "Cannot delete finalized report" }, status: :unprocessable_entity
            return
          end

          @wip_report.destroy
          render json: { success: true, message: "WIP report deleted" }
        end

        # POST /api/v1/gl/wip_reports/:id/recalculate
        def recalculate
          @wip_report.recalculate!
          render json: { success: true, data: @wip_report, message: "WIP report recalculated" }
        end

        # POST /api/v1/gl/wip_reports/:id/finalize
        def finalize
          if @wip_report.finalize!
            render json: { success: true, data: @wip_report, message: "WIP report finalized" }
          else
            render json: { success: false, error: "Report already finalized or cannot be finalized" },
                   status: :unprocessable_entity
          end
        end

        # POST /api/v1/gl/wip_reports/:id/archive
        def archive
          @wip_report.archive!
          render json: { success: true, data: @wip_report, message: "WIP report archived" }
        end

        # POST /api/v1/gl/wip_reports/:id/add_job
        def add_job
          job = Job.find(params[:job_id])
          wip_job = @wip_report.add_job!(job)
          @wip_report.calculate_totals!

          render json: { success: true, data: wip_job }
        rescue ActiveRecord::RecordNotFound
          render json: { success: false, error: "Job not found" }, status: :not_found
        rescue StandardError => e
          render json: { success: false, error: e.message }, status: :unprocessable_entity
        end

        # GET /api/v1/gl/wip_reports/summary
        def summary
          # Get latest finalized report
          latest = @corporate.gl_wip_reports.final.order(report_date: :desc).first

          return render json: { success: true, data: nil } unless latest

          render json: {
            success: true,
            data: {
              report_date: latest.report_date,
              total_contract_value: latest.total_contract_value,
              total_costs_to_date: latest.total_costs_to_date,
              total_revenue_recognized: latest.total_revenue_recognized,
              total_wip_asset: latest.total_wip_asset,
              total_wip_liability: latest.total_wip_liability,
              net_wip_position: latest.net_wip_position,
              overall_completion_pct: latest.overall_completion_pct,
              loss_job_count: latest.loss_jobs.count,
              over_budget_count: latest.over_budget_jobs.count
            }
          }
        end

        private

        def set_corporate
          @corporate = Corporate.find(params[:corporate_id])
        end

        def set_wip_report
          @wip_report = @corporate.gl_wip_reports.find(params[:id])
        end

        def wip_report_params
          params.require(:wip_report).permit(:notes)
        end
      end
    end
  end
end
