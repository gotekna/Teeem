module Api
  module V1
    class JobStagesController < ApplicationController
      before_action :set_job_stage, only: [ :show, :update, :destroy ]

      # GET /api/v1/job_stages
      # Optional params: ?job_type_id=X&job_status_id=Y (for filtering)
      def index
        if params[:job_type_id] && params[:job_status_id]
          # Get stages for specific type+status combo
          @job_stages = JobStatusStage
            .where(job_type_id: params[:job_type_id], job_status_id: params[:job_status_id])
            .includes(:job_stage)
            .order(:position)
            .map(&:job_stage)
        else
          # Get all stages
          @job_stages = JobStage.unscoped.order(:position)
        end

        render json: {
          success: true,
          job_stages: @job_stages.map { |js| job_stage_json(js) }
        }
      end

      # GET /api/v1/job_stages/:id
      def show
        render json: {
          success: true,
          job_stage: job_stage_json(@job_stage)
        }
      end

      # POST /api/v1/job_stages
      def create
        # Set position to be last if not provided
        position = job_stage_params[:position] || (JobStage.unscoped.maximum(:position) || 0) + 1

        @job_stage = JobStage.new(job_stage_params.merge(position: position))

        if @job_stage.save
          render json: {
            success: true,
            job_stage: job_stage_json(@job_stage)
          }, status: :created
        else
          render json: {
            success: false,
            errors: @job_stage.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /api/v1/job_stages/:id
      def update
        if @job_stage.update(job_stage_params)
          render json: {
            success: true,
            job_stage: job_stage_json(@job_stage)
          }
        else
          render json: {
            success: false,
            errors: @job_stage.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/job_stages/:id
      def destroy
        @job_stage.destroy
        render json: { success: true }
      end

      # POST /api/v1/job_stages/reorder
      def reorder
        params[:job_stage_ids].each_with_index do |id, index|
          JobStage.where(id: id).update_all(position: index)
        end

        render json: {
          success: true,
          job_stages: JobStage.unscoped.order(:position).map { |js| job_stage_json(js) }
        }
      end

      private

      def set_job_stage
        @job_stage = JobStage.find(params[:id])
      end

      def job_stage_params
        params.require(:job_stage).permit(:name, :position, :is_active, :color, :job_status_id)
      end

      def job_stage_json(job_stage)
        {
          id: job_stage.id,
          name: job_stage.name,
          position: job_stage.position,
          is_active: job_stage.is_active,
          color: job_stage.color,
          job_status_id: job_stage.job_status_id,
          job_status_name: job_stage.job_status&.name,
          jobs_count: job_stage.jobs.count,
          created_at: job_stage.created_at,
          updated_at: job_stage.updated_at
        }
      end
    end
  end
end
