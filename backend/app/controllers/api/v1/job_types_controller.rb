module Api
  module V1
    class JobTypesController < ApplicationController
      skip_before_action :authorize_request, only: [ :index ]
      before_action :set_job_type, only: [ :show, :update, :destroy ]

      # GET /api/v1/job_types
      def index
        @job_types = JobType.unscoped.order(:position)

        render json: {
          success: true,
          job_types: @job_types.map { |jt| job_type_json(jt) }
        }
      end

      # GET /api/v1/job_types/:id
      def show
        render json: {
          success: true,
          job_type: job_type_json(@job_type)
        }
      end

      # POST /api/v1/job_types
      def create
        # Set position to be last if not provided
        position = job_type_params[:position] || (JobType.unscoped.maximum(:position) || 0) + 1

        @job_type = JobType.new(job_type_params.merge(position: position))

        if @job_type.save
          render json: {
            success: true,
            job_type: job_type_json(@job_type)
          }, status: :created
        else
          render json: {
            success: false,
            errors: @job_type.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /api/v1/job_types/:id
      def update
        if @job_type.update(job_type_params)
          render json: {
            success: true,
            job_type: job_type_json(@job_type)
          }
        else
          render json: {
            success: false,
            errors: @job_type.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/job_types/:id
      def destroy
        @job_type.destroy
        render json: { success: true }
      end

      # POST /api/v1/job_types/reorder
      def reorder
        params[:job_type_ids].each_with_index do |id, index|
          JobType.where(id: id).update_all(position: index)
        end

        render json: {
          success: true,
          job_types: JobType.unscoped.order(:position).map { |jt| job_type_json(jt) }
        }
      end

      private

      def set_job_type
        @job_type = JobType.find(params[:id])
      end

      def job_type_params
        params.require(:job_type).permit(:name, :position, :is_active, :color, :description)
      end

      def job_type_json(job_type)
        {
          id: job_type.id,
          name: job_type.name,
          color: job_type.color || "#6366F1",
          position: job_type.position,
          is_active: job_type.is_active,
          description: job_type.description,
          jobs_count: job_type.jobs.count,
          created_at: job_type.created_at,
          updated_at: job_type.updated_at
        }
      end
    end
  end
end
