module Api
  module V1
    class PropertyInspectionsController < ApplicationController
      before_action :set_inspection, only: [:show, :update, :destroy, :complete]

      # GET /api/v1/property_inspections
      def index
        inspections = PropertyInspection.includes(:property, :tenancy, :inspector_contact)
                                        .order(scheduled_date: :desc)
        inspections = inspections.where(property_id: params[:property_id]) if params[:property_id].present?
        inspections = inspections.where(status: params[:status]) if params[:status].present?
        inspections = inspections.where(inspection_type: params[:type]) if params[:type].present?

        render_success(inspections.as_json(include: {
          property: { only: [:id, :name, :property_code] },
          inspector_contact: { only: [:id, :display_name] }
        }))
      end

      # GET /api/v1/property_inspections/:id
      def show
        render_success(@inspection.as_json(include: {
          property: { only: [:id, :name, :property_code] },
          tenancy: { only: [:id, :status] },
          inspector_contact: { only: [:id, :display_name, :email, :phone] }
        }))
      end

      # POST /api/v1/property_inspections
      def create
        inspection = PropertyInspection.new(inspection_params)

        if inspection.save
          render_success(inspection, status: :created)
        else
          render_validation_errors(inspection)
        end
      end

      # PATCH /api/v1/property_inspections/:id
      def update
        if @inspection.update(inspection_params)
          render_success(@inspection)
        else
          render_validation_errors(@inspection)
        end
      end

      # DELETE /api/v1/property_inspections/:id
      def destroy
        @inspection.destroy
        render_success
      end

      # PATCH /api/v1/property_inspections/:id/complete
      def complete
        if @inspection.update(
          status: "completed",
          completed_date: params[:completed_date] || Date.current,
          overall_condition: params[:overall_condition],
          notes: params[:notes].presence || @inspection.notes
        )
          render_success(@inspection)
        else
          render_validation_errors(@inspection)
        end
      end

      private

      def set_inspection
        @inspection = PropertyInspection.find(params[:id])
      end

      def inspection_params
        params.require(:property_inspection).permit(
          :property_id, :tenancy_id,
          :inspection_type, :scheduled_date, :completed_date,
          :inspector_contact_id, :status, :notes,
          :overall_condition, :next_inspection_date
        )
      end
    end
  end
end
