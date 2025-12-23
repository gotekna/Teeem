# frozen_string_literal: true

module Api
  module V1
    # Performance Observatory - Metrics Ingestion Controller
    # Receives frontend performance metrics (Web Vitals)
    #
    # POST /api/v1/metrics - Receive batched metrics from frontend
    # GET /api/v1/metrics/buffer_status - Check buffer status (for debugging)
    #
    class MetricsController < ApplicationController
      # Skip authentication for metrics - we want to collect from all users
      skip_before_action :authenticate_user!, only: [:create]

      # POST /api/v1/metrics
      # Receives batched metrics from frontend
      #
      # Expected payload:
      # {
      #   metrics: [
      #     { metric_name: "LCP", value: 2100, page_path: "/jobs", rating: "needs-improvement" },
      #     { metric_name: "FID", value: 50, page_path: "/jobs", rating: "good" }
      #   ],
      #   session_id: "abc123",
      #   user_agent: "Mozilla/5.0..."
      # }
      #
      def create
        metrics = params[:metrics] || []

        if metrics.empty?
          return render json: { success: false, error: "No metrics provided" }, status: :bad_request
        end

        # Extract common fields
        session_id = params[:session_id]
        user_agent = request.user_agent

        # Push each metric to the buffer
        metrics.each do |metric|
          Performance::Buffer.push_vital(
            metric_name: metric[:metric_name] || metric[:name],
            value: metric[:value],
            page_path: metric[:page_path] || metric[:path],
            session_id: session_id,
            user_agent: user_agent,
            user_id: current_user&.id,
            rating: metric[:rating],
            metadata: metric[:metadata] || {}
          )
        end

        render json: { success: true, received: metrics.length }
      end

      # GET /api/v1/metrics/buffer_status
      # Returns current buffer status (for debugging)
      def buffer_status
        stats = Performance::Buffer.stats

        render json: {
          success: true,
          buffer: stats,
          environment: Rails.env
        }
      end
    end
  end
end
