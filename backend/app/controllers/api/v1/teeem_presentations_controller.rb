# frozen_string_literal: true

module Api
  module V1
    class TeeemPresentationsController < ApplicationController
      before_action :set_presentation, only: [:show, :update, :destroy, :export]

      # GET /api/v1/teeem_presentations
      # Optional params:
      #   - job_id: filter by job (returns presentations attached to this job)
      #   - unattached: if "true", returns only presentations not attached to any job
      def index
        presentations = current_user.teeem_presentations.user_presentations.recent

        # Filter by job if specified
        if params[:job_id].present?
          presentations = presentations.for_job(params[:job_id])
        elsif params[:unattached] == "true"
          presentations = presentations.unattached
        end

        render json: {
          success: true,
          data: presentations.map { |p| presentation_summary(p) }
        }
      end

      # GET /api/v1/teeem_presentations/:id
      def show
        render json: {
          success: true,
          data: presentation_detail(@presentation)
        }
      end

      # POST /api/v1/teeem_presentations
      def create
        presentation = current_user.teeem_presentations.build(presentation_params)

        if presentation.save
          render json: {
            success: true,
            data: presentation_detail(presentation)
          }, status: :created
        else
          render json: {
            success: false,
            error: presentation.errors.full_messages.join(", ")
          }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/teeem_presentations/:id
      def update
        if @presentation.update(presentation_params)
          render json: {
            success: true,
            data: presentation_detail(@presentation)
          }
        else
          render json: {
            success: false,
            error: @presentation.errors.full_messages.join(", ")
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/teeem_presentations/:id
      def destroy
        @presentation.destroy
        render json: { success: true }
      end

      # GET /api/v1/teeem_presentations/:id/export
      # Exports presentation data (PPTX generation done client-side via PptxGenJS)
      def export
        render json: {
          success: true,
          data: {
            name: @presentation.name,
            slides: @presentation.data["slides"] || [],
            theme: @presentation.data["theme"] || {},
            metadata: @presentation.data["metadata"] || {}
          }
        }
      end

      private

      def set_presentation
        @presentation = current_user.teeem_presentations.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Presentation not found" }, status: :not_found
      end

      def presentation_params
        params.require(:teeem_presentation).permit(:name, :is_template, :job_id, :description, data: {})
      end

      def presentation_summary(presentation)
        slide_count = presentation.data.dig("slides")&.length || 0
        {
          id: presentation.id,
          name: presentation.name,
          description: presentation.description,
          isTemplate: presentation.is_template,
          jobId: presentation.job_id,
          jobName: presentation.job&.name,
          slideCount: slide_count,
          updatedAt: presentation.updated_at.iso8601,
          createdAt: presentation.created_at.iso8601
        }
      end

      def presentation_detail(presentation)
        {
          id: presentation.id,
          name: presentation.name,
          description: presentation.description,
          isTemplate: presentation.is_template,
          data: presentation.data,
          jobId: presentation.job_id,
          jobName: presentation.job&.name,
          updatedAt: presentation.updated_at.iso8601,
          createdAt: presentation.created_at.iso8601
        }
      end
    end
  end
end
