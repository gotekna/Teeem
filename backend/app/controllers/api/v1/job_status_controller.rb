module Api
  module V1
    class JobStatusController < ApplicationController
      before_action :set_job_status, only: [ :show, :update, :destroy ]

      # GET /api/v1/job_statuses
      def index
        @job_statuses = JobStatus.order(:position)

        render json: {
          success: true,
          job_statuses: @job_statuses.map { |js| job_status_json(js) }
        }
      end

      # GET /api/v1/job_statuses/:id
      def show
        render json: {
          success: true,
          job_status: job_status_json(@job_status)
        }
      end

      # POST /api/v1/job_statuses
      def create
        # Set position to be last if not provided
        position = job_status_params[:position] || (JobStatus.maximum(:position) || 0) + 1

        @job_status = JobStatus.new(job_status_params.except(:job_type_ids).merge(position: position))

        if @job_status.save
          # Handle job_type_ids for many-to-many relationship
          if params[:job_status][:job_type_ids].present?
            update_job_type_associations(@job_status, params[:job_status][:job_type_ids])
          end

          render json: {
            success: true,
            job_status: job_status_json(@job_status)
          }, status: :created
        else
          render json: {
            success: false,
            errors: @job_status.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /api/v1/job_statuses/:id
      def update
        if @job_status.update(job_status_params.except(:job_type_ids))
          # Handle job_type_ids for many-to-many relationship
          if params[:job_status].key?(:job_type_ids)
            update_job_type_associations(@job_status, params[:job_status][:job_type_ids])
          end

          render json: {
            success: true,
            job_status: job_status_json(@job_status)
          }
        else
          render json: {
            success: false,
            errors: @job_status.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/job_statuses/:id
      def destroy
        @job_status.destroy
        render json: { success: true }
      end

      # POST /api/v1/job_statuses/reorder
      def reorder
        params[:job_status_ids].each_with_index do |id, index|
          JobStatus.where(id: id).update_all(position: index)
        end

        render json: {
          success: true,
          job_statuses: JobStatus.order(:position).map { |js| job_status_json(js) }
        }
      end

      private

      def set_job_status
        @job_status = JobStatus.find(params[:id])
      end

      def job_status_params
        params.require(:job_status).permit(:name, :position, :is_active, :color, :job_type_id, job_type_ids: [])
      end

      def update_job_type_associations(job_status, job_type_ids)
        # Clear existing associations
        job_status.job_type_statuses.destroy_all

        # Create new associations
        Array(job_type_ids).compact.each do |job_type_id|
          job_status.job_type_statuses.create(job_type_id: job_type_id)
        end
      end

      def job_status_json(job_status)
        {
          id: job_status.id,
          name: job_status.name,
          position: job_status.position,
          is_active: job_status.is_active,
          color: job_status.color,
          # job_type relationship is now many-to-many through job_type_statuses
          job_type_ids: job_status.job_type_ids,
          job_type_names: job_status.job_types.pluck(:name),
          jobs_count: job_status.jobs.count,
          created_at: job_status.created_at,
          updated_at: job_status.updated_at
        }
      end
    end
  end
end
