module Api
  module V1
    class WorkflowDefinitionsController < ApplicationController
      before_action :set_workflow_definition, only: [ :show, :update, :destroy ]

      # GET /api/v1/workflow_definitions
      def index
        @workflow_definitions = WorkflowDefinition.all.order(created_at: :desc)
        render json: {
          success: true,
          workflow_definitions: @workflow_definitions
        }
      end

      # GET /api/v1/workflow_definitions/:id
      def show
        render json: {
          success: true,
          workflow_definition: @workflow_definition
        }
      end

      # POST /api/v1/workflow_definitions
      def create
        @workflow_definition = WorkflowDefinition.new(workflow_definition_params)

        if @workflow_definition.save
          render json: {
            success: true,
            workflow_definition: @workflow_definition
          }, status: :created
        else
          render json: {
            success: false,
            errors: @workflow_definition.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/workflow_definitions/:id
      def update
        if @workflow_definition.update(workflow_definition_params)
          render json: {
            success: true,
            workflow_definition: @workflow_definition
          }
        else
          render json: {
            success: false,
            errors: @workflow_definition.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/workflow_definitions/:id
      def destroy
        @workflow_definition.destroy
        render json: {
          success: true,
          message: "Workflow definition deleted successfully"
        }
      end

      private

      def set_workflow_definition
        @workflow_definition = WorkflowDefinition.find(params[:id])
      end

      def workflow_definition_params
        params.require(:workflow_definition).permit(:name, :description, :workflow_type, :active, config: {})
      end
    end
  end
end
