module Api
  module V1
    class JobStatusStagesController < ApplicationController
      # GET /api/v1/job_types/:job_type_id/statuses/:job_status_id/stages
      def index
        stages = JobStatusStage
          .where(job_type_id: params[:job_type_id], job_status_id: params[:job_status_id])
          .includes(:job_stage)
          .order(:position)

        render json: {
          success: true,
          job_type_id: params[:job_type_id],
          job_status_id: params[:job_status_id],
          stages: stages.map do |jss|
            {
              id: jss.job_stage.id,
              name: jss.job_stage.name,
              color: jss.job_stage.color,
              position: jss.position,
              is_required: jss.is_required,
              job_status_stage_id: jss.id
            }
          end
        }
      end

      # POST /api/v1/job_types/:job_type_id/statuses/:job_status_id/stages
      # Params: { job_stage_id: X, is_required: true }
      def create
        position = JobStatusStage
          .where(job_type_id: params[:job_type_id], job_status_id: params[:job_status_id])
          .maximum(:position) || -1
        position += 1

        jss = JobStatusStage.create!(
          job_type_id: params[:job_type_id],
          job_status_id: params[:job_status_id],
          job_stage_id: params[:job_stage_id],
          is_required: params[:is_required] || false,
          position: position
        )

        render json: {
          success: true,
          job_status_stage: {
            id: jss.id,
            job_type_id: jss.job_type_id,
            job_status_id: jss.job_status_id,
            job_stage_id: jss.job_stage_id,
            position: jss.position,
            is_required: jss.is_required
          }
        }, status: :created
      end

      # DELETE /api/v1/job_status_stages/:id
      def destroy
        jss = JobStatusStage.find(params[:id])
        jss.destroy
        render json: { success: true }
      end

      # POST /api/v1/job_types/:job_type_id/statuses/:job_status_id/stages/reorder
      # Params: { job_status_stage_ids: [1, 2, 3] }
      def reorder
        params[:job_status_stage_ids].each_with_index do |id, index|
          JobStatusStage.where(id: id).update_all(position: index)
        end

        render json: { success: true }
      end
    end
  end
end
