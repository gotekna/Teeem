# frozen_string_literal: true

module Api
  module V1
    class ColourSelectionTemplatesController < ApplicationController
      before_action :set_template, only: [:show, :update, :destroy]

      # GET /api/v1/colour_selection_templates
      def index
        templates = ColourSelectionTemplate.includes(:job_type).order(:name)
        templates = templates.active if params[:active_only]

        render json: {
          success: true,
          data: templates.map { |t| template_json(t) }
        }
      end

      # GET /api/v1/colour_selection_templates/:id
      def show
        render json: { success: true, data: template_json(@template) }
      end

      # POST /api/v1/colour_selection_templates
      def create
        template = ColourSelectionTemplate.new(template_params)

        if template.save
          render json: { success: true, data: template_json(template) }, status: :created
        else
          render json: { success: false, error: template.errors.full_messages.join(", ") }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/colour_selection_templates/:id
      def update
        if @template.update(template_params)
          render json: { success: true, data: template_json(@template) }
        else
          render json: { success: false, error: @template.errors.full_messages.join(", ") }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/colour_selection_templates/:id
      def destroy
        @template.destroy
        render json: { success: true, message: "Template deleted" }
      end

      # GET /api/v1/colour_selection_templates/for_job_type/:job_type_id
      def for_job_type
        template = ColourSelectionTemplate.for_job_type(params[:job_type_id])

        if template
          render json: { success: true, data: template_json(template) }
        else
          render json: { success: false, error: "No template found" }, status: :not_found
        end
      end

      private

      def set_template
        @template = ColourSelectionTemplate.find(params[:id])
      end

      def template_params
        params.require(:colour_selection_template).permit(
          :name,
          :job_type_id,
          :is_default,
          :is_active,
          categories: [:key, :name, :position, items: [:key, :name]]
        )
      end

      def template_json(template)
        {
          id: template.id,
          name: template.name,
          job_type_id: template.job_type_id,
          job_type_name: template.job_type&.name,
          categories: template.categories,
          is_default: template.is_default,
          is_active: template.is_active,
          created_at: template.created_at,
          updated_at: template.updated_at
        }
      end
    end
  end
end
