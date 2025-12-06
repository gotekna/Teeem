module Api
  module V1
    class TaskTemplatesController < ApplicationController
      before_action :set_task_template, only: [ :show, :update, :destroy ]

      # GET /api/v1/task_templates
      def index
        @task_templates = TaskTemplate.by_sequence

        render json: {
          success: true,
          task_templates: @task_templates.map { |template| template_to_json(template) }
        }
      end

      # GET /api/v1/task_templates/:id
      def show
        render json: {
          success: true,
          task_template: template_to_json(@task_template)
        }
      end

      # POST /api/v1/task_templates
      def create
        @task_template = TaskTemplate.new(task_template_params)

        if @task_template.save
          render json: {
            success: true,
            message: "Task template created successfully",
            task_template: template_to_json(@task_template)
          }, status: :created
        else
          render json: {
            success: false,
            errors: @task_template.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PUT/PATCH /api/v1/task_templates/:id
      def update
        if @task_template.update(task_template_params)
          render json: {
            success: true,
            message: "Task template updated successfully",
            task_template: template_to_json(@task_template)
          }
        else
          render json: {
            success: false,
            errors: @task_template.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/task_templates/:id
      def destroy
        @task_template.destroy

        render json: {
          success: true,
          message: "Task template deleted successfully"
        }
      end

      private

      def set_task_template
        @task_template = TaskTemplate.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: {
          success: false,
          error: "Task template not found"
        }, status: :not_found
      end

      def task_template_params
        params.require(:task_template).permit(
          :name,
          :task_type,
          :category,
          :default_duration_days,
          :description,
          :is_milestone,
          :requires_photo,
          :sequence_order,
          :is_standard,
          predecessor_template_codes: []
        )
      end

      def template_to_json(template)
        {
          id: template.id,
          name: template.name,
          task_type: template.task_type,
          category: template.category,
          default_duration_days: template.default_duration_days,
          description: template.description,
          is_milestone: template.is_milestone,
          requires_photo: template.requires_photo,
          sequence_order: template.sequence_order,
          is_standard: template.is_standard,
          predecessor_template_codes: template.predecessor_template_codes,
          created_at: template.created_at,
          updated_at: template.updated_at
        }
      end
    end
  end
end
