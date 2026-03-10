module Api
  module V1
    class InspectionRoomTemplatesController < ApplicationController
      before_action :set_template, only: [:show, :update, :destroy]

      # GET /api/v1/inspection_room_templates
      def index
        templates = InspectionRoomTemplate.active.order(:property_type_name, :name)
        render_success(templates)
      end

      # GET /api/v1/inspection_room_templates/:id
      def show
        render_success(@template)
      end

      # POST /api/v1/inspection_room_templates
      def create
        template = InspectionRoomTemplate.new(template_params)

        if template.save
          render_success(template, status: :created)
        else
          render_validation_errors(template)
        end
      end

      # PATCH /api/v1/inspection_room_templates/:id
      def update
        if @template.update(template_params)
          render_success(@template)
        else
          render_validation_errors(@template)
        end
      end

      # DELETE /api/v1/inspection_room_templates/:id
      def destroy
        @template.destroy
        render_success
      end

      # POST /api/v1/inspection_room_templates/seed_defaults
      def seed_defaults
        InspectionRoomTemplate.seed_defaults!(current_tenant.id)
        templates = InspectionRoomTemplate.where(tenant_id: current_tenant.id, is_default: true)
        render_success(templates)
      end

      private

      def set_template
        @template = InspectionRoomTemplate.find(params[:id])
      end

      def template_params
        params.require(:inspection_room_template).permit(
          :name, :property_type_name, :is_default, :active,
          rooms: [:name, :room_type, items: [:name]]
        )
      end
    end
  end
end
