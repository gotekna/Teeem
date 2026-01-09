# frozen_string_literal: true

module Api
  module V1
    class PlanReextractionsController < ApplicationController
      before_action :set_job
      before_action :set_reextraction, only: [:show]

      # POST /api/v1/jobs/:job_id/plan_reextractions
      # Start a new batch re-extraction for all plans
      def create
        # Check for existing active reextraction
        existing = @job.plan_reextractions.active.first
        if existing
          render json: {
            success: false,
            error: "A re-extraction is already in progress"
          }, status: :conflict
          return
        end

        # Create new reextraction record
        reextraction = @job.plan_reextractions.create!(status: "pending")

        # Queue the job
        PlanReextractionJob.perform_later(reextraction.id)

        render json: {
          success: true,
          data: reextraction.as_json_status
        }
      end

      # GET /api/v1/jobs/:job_id/plan_reextractions/:id
      # Poll for progress
      def show
        render json: {
          success: true,
          data: @reextraction.as_json_status
        }
      end

      private

      def set_job
        @job = Job.find(params[:job_id])
      end

      def set_reextraction
        @reextraction = @job.plan_reextractions.find(params[:id])
      end
    end
  end
end
