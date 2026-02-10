module Api
  module V1
    class JobPlanRevisionsController < ApplicationController
      before_action :set_job
      before_action :set_job_plan
      before_action :set_revision, only: [:show, :update, :destroy]

      # GET /api/v1/jobs/:job_id/job_plans/:job_plan_id/revisions
      def index
        @revisions = @job_plan.revisions.includes(:issued_by).ordered

        render json: {
          success: true,
          data: @revisions.map { |r| serialize_revision(r) }
        }
      end

      # GET /api/v1/jobs/:job_id/job_plans/:job_plan_id/revisions/:id
      def show
        render json: {
          success: true,
          data: serialize_revision(@revision)
        }
      end

      # POST /api/v1/jobs/:job_id/job_plans/:job_plan_id/revisions
      def create
        @revision = @job_plan.revisions.build(revision_params)

        # Auto-set revision code if not provided
        if @revision.revision.blank?
          format = RevisionFormat.default_format
          @revision.revision = format&.next_revision(@job_plan.revisions.maximum(:revision)) || 'A'
        end

        @revision.revision_date ||= Date.current

        if @revision.save
          render json: {
            success: true,
            data: serialize_revision(@revision)
          }, status: :created
        else
          render json: {
            success: false,
            error: @revision.errors.full_messages.join(', ')
          }, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /api/v1/jobs/:job_id/job_plans/:job_plan_id/revisions/:id
      def update
        if @revision.update(revision_params)
          render json: {
            success: true,
            data: serialize_revision(@revision)
          }
        else
          render json: {
            success: false,
            error: @revision.errors.full_messages.join(', ')
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/jobs/:job_id/job_plans/:job_plan_id/revisions/:id
      def destroy
        # Don't allow deleting the current revision
        if @job_plan.current_revision_id == @revision.id
          return render json: {
            success: false,
            error: 'Cannot delete the current revision. Set another revision as current first.'
          }, status: :unprocessable_entity
        end

        @revision.destroy
        render json: { success: true }
      end

      private

      def set_job
        @job = Job.find(params[:job_id])
      end

      def set_job_plan
        @job_plan = @job.job_plans.find(params[:job_plan_id])
      end

      def set_revision
        @revision = @job_plan.revisions.find(params[:id])
      end

      def revision_params
        params.require(:revision).permit(
          :revision,
          :revision_date,
          :issued_date,
          :is_on_issue,
          :storage_file_id,
          :storage_web_url,
          :file_name,
          :file_size,
          :notes
        )
      end

      def serialize_revision(revision)
        {
          id: revision.id,
          job_plan_id: revision.job_plan_id,
          revision: revision.revision,
          revision_label: revision.revision_label,
          revision_date: revision.revision_date,
          issued_date: revision.issued_date,
          is_on_issue: revision.is_on_issue,
          has_file: revision.has_file?,
          storage_file_id: revision.storage_reference,
          storage_reference: revision.storage_reference,
          storage_web_url: revision.storage_web_url,
          file_name: revision.file_name,
          file_size: revision.file_size,
          formatted_file_size: revision.formatted_file_size,
          notes: revision.notes,
          issued_by: revision.issued_by ? {
            id: revision.issued_by.id,
            name: revision.issued_by.name
          } : nil,
          created_at: revision.created_at,
          updated_at: revision.updated_at
        }
      end
    end
  end
end
