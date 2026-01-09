module Api
  module V1
    class SupervisorChecklistTemplatesController < ApplicationController
      before_action :set_template, only: [ :show, :update, :destroy ]

      # GET /api/v1/supervisor_checklist_templates
      def index
        @templates = SupervisorChecklistTemplate.active.ordered
        render json: @templates
      end

      # GET /api/v1/supervisor_checklist_templates/:id
      def show
        render json: @template
      end

      # POST /api/v1/supervisor_checklist_templates
      def create
        @template = SupervisorChecklistTemplate.new(template_params)

        if @template.save
          render json: @template, status: :created
        else
          render json: { errors: @template.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /api/v1/supervisor_checklist_templates/:id
      def update
        if @template.update(template_params)
          render json: @template
        else
          render json: { errors: @template.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/supervisor_checklist_templates/:id
      def destroy
        @template.destroy
        head :no_content
      end

      # POST /api/v1/supervisor_checklist_templates/reorder
      def reorder
        params[:templates].each_with_index do |template_data, index|
          template = SupervisorChecklistTemplate.find(template_data[:id])
          template.update(sequence_order: index)
        end

        head :no_content
      end

      # GET /api/v1/supervisor_checklist_templates/categories
      def categories
        render json: SupervisorChecklistTemplate.categories
      end

      private

      def set_template
        @template = SupervisorChecklistTemplate.find(params[:id])
      end

      def template_params
        params.require(:supervisor_checklist_template).permit(
          :name,
          :description,
          :category,
          :sequence_order,
          :is_active,
          :response_type
        )
      end
    end
  end
end
