# frozen_string_literal: true

module Api
  module V1
    class SmAnalyticsController < ApplicationController
      before_action :set_construction

      # GET /api/v1/constructions/:construction_id/sm_analytics/critical_path
      def critical_path
        result = SmCriticalPathService.calculate(@construction)

        render json: {
          success: true,
          construction_id: @construction.id,
          critical_path: result
        }
      end

      # GET /api/v1/constructions/:construction_id/sm_analytics/delay_impact
      def delay_impact
        task_id = params[:task_id].to_i
        delay_days = params[:delay_days].to_i

        result = SmCriticalPathService.delay_impact(@construction, task_id, delay_days)

        render json: {
          success: true,
          task_id: task_id,
          delay_days: delay_days,
          impact: result
        }
      end

      # GET /api/v1/constructions/:construction_id/sm_analytics/evm
      def evm
        as_of = params[:as_of_date] ? Date.parse(params[:as_of_date]) : Date.current
        result = SmEvmService.calculate(@construction, as_of_date: as_of)

        render json: {
          success: true,
          construction_id: @construction.id,
          evm: result
        }
      end

      # GET /api/v1/constructions/:construction_id/sm_analytics/s_curve
      def s_curve
        as_of = params[:as_of_date] ? Date.parse(params[:as_of_date]) : Date.current
        result = SmEvmService.s_curve(@construction, as_of_date: as_of)

        render json: {
          success: true,
          construction_id: @construction.id,
          s_curve: result
        }
      end

      # GET /api/v1/constructions/:construction_id/sm_analytics/baselines
      def baselines
        baselines = @construction.sm_baselines.recent.includes(:created_by)

        render json: {
          success: true,
          baselines: baselines.map { |b| baseline_json(b) }
        }
      end

      # POST /api/v1/constructions/:construction_id/sm_analytics/baselines
      def create_baseline
        baseline = SmBaseline.create_snapshot(
          @construction,
          name: params[:name] || "Baseline #{Date.current}",
          created_by: current_user
        )

        render json: {
          success: true,
          baseline: baseline_json(baseline)
        }, status: :created
      end

      # GET /api/v1/constructions/:construction_id/sm_analytics/baselines/:id/compare
      def compare_baseline
        baseline = @construction.sm_baselines.find(params[:id])
        comparison = baseline.compare_to_current

        render json: {
          success: true,
          comparison: comparison
        }
      end

      # GET /api/v1/constructions/:construction_id/sm_analytics/variance
      def variance
        active_baseline = @construction.sm_baselines.active.first

        unless active_baseline
          return render json: {
            success: false,
            error: 'No active baseline found. Create a baseline first.'
          }, status: :not_found
        end

        comparison = active_baseline.compare_to_current

        render json: {
          success: true,
          baseline: baseline_json(active_baseline),
          variance: comparison
        }
      end

      # GET /api/v1/constructions/:construction_id/sm_analytics/summary
      def summary
        critical_path = SmCriticalPathService.calculate(@construction)
        evm = SmEvmService.calculate(@construction)
        active_baseline = @construction.sm_baselines.active.first
        variance = active_baseline&.compare_to_current

        render json: {
          success: true,
          construction_id: @construction.id,
          summary: {
            critical_path: {
              duration_days: critical_path[:project_duration],
              critical_tasks: critical_path[:summary][:critical_tasks],
              total_tasks: critical_path[:summary][:total_tasks]
            },
            evm: {
              spi: evm[:indices][:spi],
              cpi: evm[:indices][:cpi],
              percent_complete: evm[:progress][:percent_complete],
              health: evm[:health]
            },
            variance: variance ? {
              delayed_tasks: variance[:summary][:delayed_tasks],
              on_track_tasks: variance[:summary][:on_track_tasks],
              schedule_health: variance[:summary][:schedule_health]
            } : nil,
            has_baseline: active_baseline.present?
          }
        }
      end

      private

      def set_construction
        @construction = Construction.find(params[:construction_id])
      end

      def baseline_json(baseline)
        {
          id: baseline.id,
          name: baseline.name,
          baseline_date: baseline.baseline_date,
          is_active: baseline.is_active,
          task_count: baseline.task_count,
          created_by: baseline.created_by&.full_name,
          created_at: baseline.created_at
        }
      end
    end
  end
end
