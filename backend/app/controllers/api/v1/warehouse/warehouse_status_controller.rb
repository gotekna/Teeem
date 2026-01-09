module Api
  module V1
    module Warehouse
      class WarehouseStatusController < ApplicationController
      # GET /api/v1/warehouse/status
      # Returns overall warehouse health and status
      def index
        render json: {
          success: true,
          generated_at: Time.current.iso8601,
          health: health_summary,
          views: view_statuses,
          recent_activity: recent_activity
        }
      end

      # GET /api/v1/warehouse/status/:view_name
      # Returns detailed status for a specific view
      def show
        view_name = params[:id]

        unless valid_view?(view_name)
          render json: { success: false, error: "View '#{view_name}' not found" }, status: :not_found
          return
        end

        stats = MvRefreshLog.stats_for_view(view_name)
        recent_logs = MvRefreshLog.for_view(view_name)
                                  .order(started_at: :desc)
                                  .limit(20)

        render json: {
          success: true,
          view_name: view_name,
          statistics: stats,
          recent_logs: recent_logs.map { |log| serialize_log(log) }
        }
      end

      # POST /api/v1/warehouse/refresh
      # Manually trigger a refresh
      def refresh
        view_name = params[:view_name] || :all

        if view_name.to_s != "all" && !valid_view?(view_name)
          render json: { success: false, error: "View '#{view_name}' not found" }, status: :bad_request
          return
        end

        # Queue the refresh job
        RefreshMaterializedViewsJob.perform_later(view_name.to_s)

        render json: {
          success: true,
          message: "Refresh queued for #{view_name == :all ? 'all views' : view_name}",
          queued_at: Time.current.iso8601
        }
      end

      # GET /api/v1/warehouse/health
      # Quick health check endpoint
      def health
        health_data = MvRefreshLog.health_check

        overall_status = if health_data.any? { |v| v[:status] == "error" }
                           "error"
        elsif health_data.any? { |v| v[:status] == "stale" }
                           "stale"
        elsif health_data.any? { |v| v[:status] == "warning" }
                           "warning"
        elsif health_data.any? { |v| v[:status] == "unknown" }
                           "unknown"
        else
                           "healthy"
        end

        render json: {
          success: true,
          status: overall_status,
          checked_at: Time.current.iso8601,
          views: health_data
        }
      end

      private

      def health_summary
        health_data = MvRefreshLog.health_check

        {
          total_views: health_data.count,
          healthy: health_data.count { |v| v[:status] == "healthy" },
          stale: health_data.count { |v| v[:status] == "stale" },
          warning: health_data.count { |v| v[:status] == "warning" },
          error: health_data.count { |v| v[:status] == "error" },
          unknown: health_data.count { |v| v[:status] == "unknown" }
        }
      end

      def view_statuses
        RefreshMaterializedViewsJob::VIEWS.map do |key, config|
          view_name = config[:name]
          stats = MvRefreshLog.stats_for_view(view_name, days: 1)

          {
            key: key.to_s,
            name: view_name,
            concurrent_refresh: config[:concurrent],
            last_refresh: stats[:last_success]&.iso8601,
            last_failure: stats[:last_failure]&.iso8601,
            row_count: stats[:latest_row_count],
            avg_duration_seconds: stats[:avg_duration_seconds],
            success_rate_24h: stats[:success_rate]
          }
        end
      end

      def recent_activity
        MvRefreshLog.order(started_at: :desc)
                    .limit(20)
                    .map { |log| serialize_log(log) }
      end

      def valid_view?(view_name)
        RefreshMaterializedViewsJob::VIEWS.values.any? { |config| config[:name] == view_name }
      end

      def serialize_log(log)
        {
          id: log.id,
          view_name: log.view_name,
          status: log.status,
          started_at: log.started_at.iso8601,
          completed_at: log.completed_at&.iso8601,
          duration_seconds: log.duration_seconds,
          row_count: log.row_count,
          previous_row_count: log.previous_row_count,
          row_count_change: log.row_count && log.previous_row_count ? log.row_count - log.previous_row_count : nil,
          triggered_by: log.triggered_by,
          error_message: log.error_message
        }
      end
      end
    end
  end
end
