module Api
  module V1
    class WorkflowStepsController < ApplicationController
      before_action :set_workflow_step, only: [ :show, :approve, :reject, :request_changes ]

      # GET /api/v1/workflow_steps
      # Get all workflow steps pending for current user
      def index
        @workflow_steps = WorkflowExecutionService.pending_for_user(current_user)

        render json: {
          success: true,
          workflow_steps: @workflow_steps.map { |step| step_with_details(step) }
        }
      end

      # GET /api/v1/workflow_steps/:id
      def show
        render json: {
          success: true,
          workflow_step: step_with_details(@workflow_step)
        }
      end

      # POST /api/v1/workflow_steps/:id/approve
      def approve
        unless @workflow_step.can_action?(current_user)
          return render json: {
            success: false,
            error: "You are not authorized to approve this step"
          }, status: :forbidden
        end

        @workflow_step.approve!(user: current_user, comment: params[:comment])

        render json: {
          success: true,
          workflow_step: step_with_details(@workflow_step),
          workflow_instance: @workflow_step.workflow_instance
        }
      rescue => e
        render json: {
          success: false,
          error: e.message
        }, status: :unprocessable_entity
      end

      # POST /api/v1/workflow_steps/:id/reject
      def reject
        unless @workflow_step.can_action?(current_user)
          return render json: {
            success: false,
            error: "You are not authorized to reject this step"
          }, status: :forbidden
        end

        @workflow_step.reject!(user: current_user, comment: params[:comment])

        render json: {
          success: true,
          workflow_step: step_with_details(@workflow_step),
          workflow_instance: @workflow_step.workflow_instance
        }
      rescue => e
        render json: {
          success: false,
          error: e.message
        }, status: :unprocessable_entity
      end

      # POST /api/v1/workflow_steps/:id/request_changes
      def request_changes
        unless @workflow_step.can_action?(current_user)
          return render json: {
            success: false,
            error: "You are not authorized to request changes for this step"
          }, status: :forbidden
        end

        @workflow_step.request_changes!(user: current_user, comment: params[:comment])

        render json: {
          success: true,
          workflow_step: step_with_details(@workflow_step)
        }
      rescue => e
        render json: {
          success: false,
          error: e.message
        }, status: :unprocessable_entity
      end

      private

      def set_workflow_step
        @workflow_step = WorkflowStep.find(params[:id])
      end

      def step_with_details(step)
        step.as_json.merge(
          workflow_instance: step.workflow_instance.as_json(
            include: {
              workflow_definition: { only: [ :id, :name, :description, :workflow_type ] },
              subject: { only: [ :id ] }
            }
          ),
          assigned_to: step.assigned_to&.as_json(only: [ :id, :name, :email ])
        )
      end
    end
  end
end
