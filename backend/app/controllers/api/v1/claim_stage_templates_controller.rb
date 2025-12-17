# frozen_string_literal: true

module Api
  module V1
    class ClaimStageTemplatesController < ApplicationController
      before_action :set_job_type, only: [:index, :create, :reorder]
      before_action :set_template, only: [:show, :update, :destroy]

      # GET /api/v1/job_types/:job_type_id/claim_stage_templates
      def index
        templates = @job_type.claim_stage_templates.ordered

        render json: {
          success: true,
          data: {
            templates: templates.map { |t| template_json(t) },
            job_type: { id: @job_type.id, name: @job_type.name },
            total_percentage: templates.sum(:percentage).to_f
          }
        }
      end

      # GET /api/v1/claim_stage_templates/:id
      def show
        render json: { success: true, data: template_json(@template) }
      end

      # POST /api/v1/job_types/:job_type_id/claim_stage_templates
      def create
        @template = @job_type.claim_stage_templates.build(template_params)

        # Auto-set sequence order if not provided
        unless @template.sequence_order.present?
          max_order = @job_type.claim_stage_templates.maximum(:sequence_order) || -1
          @template.sequence_order = max_order + 1
        end

        if @template.save
          render json: { success: true, data: template_json(@template) }, status: :created
        else
          render json: { success: false, error: @template.errors.full_messages.join(", ") },
                 status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/claim_stage_templates/:id
      def update
        if @template.update(template_params)
          render json: { success: true, data: template_json(@template) }
        else
          render json: { success: false, error: @template.errors.full_messages.join(", ") },
                 status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/claim_stage_templates/:id
      def destroy
        @template.destroy
        render json: { success: true, data: { id: params[:id] } }
      end

      # POST /api/v1/job_types/:job_type_id/claim_stage_templates/reorder
      def reorder
        order_ids = params[:order_ids]

        unless order_ids.is_a?(Array)
          return render json: { success: false, error: "order_ids must be an array" },
                        status: :unprocessable_entity
        end

        ClaimStageTemplate.transaction do
          order_ids.each_with_index do |id, index|
            @job_type.claim_stage_templates.find(id).update!(sequence_order: index)
          end
        end

        templates = @job_type.claim_stage_templates.ordered
        render json: {
          success: true,
          data: { templates: templates.map { |t| template_json(t) } }
        }
      rescue ActiveRecord::RecordNotFound => e
        render json: { success: false, error: "Template not found: #{e.message}" },
               status: :not_found
      end

      private

      def set_job_type
        @job_type = JobType.find(params[:job_type_id])
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Job type not found" }, status: :not_found
      end

      def set_template
        @template = ClaimStageTemplate.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Template not found" }, status: :not_found
      end

      def template_params
        params.require(:claim_stage_template).permit(
          :name, :percentage, :sequence_order, :description,
          :invoice_match_pattern, :is_active
        )
      end

      def template_json(template)
        {
          id: template.id,
          job_type_id: template.job_type_id,
          name: template.name,
          percentage: template.percentage.to_f,
          sequence_order: template.sequence_order,
          description: template.description,
          invoice_match_pattern: template.invoice_match_pattern,
          is_active: template.is_active,
          created_at: template.created_at,
          updated_at: template.updated_at
        }
      end
    end
  end
end
