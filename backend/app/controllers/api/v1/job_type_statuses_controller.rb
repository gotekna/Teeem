module Api
  module V1
    class JobTypeStatusesController < ApplicationController
      # GET /api/v1/job_types/:job_type_id/statuses
      def index
        job_type = JobType.find(params[:job_type_id])
        statuses = job_type.job_type_statuses.includes(:job_status).order(:position)

        render json: {
          success: true,
          job_type: { id: job_type.id, name: job_type.name },
          statuses: statuses.map do |jts|
            {
              id: jts.job_status.id,
              name: jts.job_status.name,
              color: jts.job_status.color,
              position: jts.position,
              job_type_status_id: jts.id
            }
          end
        }
      end

      # POST /api/v1/job_types/:job_type_id/statuses
      # Params: { job_status_id: X }
      def create
        job_type = JobType.find(params[:job_type_id])
        position = (job_type.job_type_statuses.maximum(:position) || -1) + 1

        jts = job_type.job_type_statuses.create!(
          job_status_id: params[:job_status_id],
          position: position
        )

        render json: {
          success: true,
          job_type_status: {
            id: jts.id,
            job_type_id: jts.job_type_id,
            job_status_id: jts.job_status_id,
            position: jts.position
          }
        }, status: :created
      end

      # DELETE /api/v1/job_type_statuses/:id
      def destroy
        jts = JobTypeStatus.find(params[:id])
        jts.destroy
        render json: { success: true }
      end

      # POST /api/v1/job_types/:job_type_id/statuses/reorder
      # Params: { job_type_status_ids: [1, 2, 3] }
      def reorder
        params[:job_type_status_ids].each_with_index do |id, index|
          JobTypeStatus.where(id: id).update_all(position: index)
        end

        render json: { success: true }
      end
    end
  end
end
