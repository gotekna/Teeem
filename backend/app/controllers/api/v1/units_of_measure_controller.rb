module Api
  module V1
    class UnitsOfMeasureController < ApplicationController
      before_action :set_unit, only: [:update, :destroy]

      # GET /api/v1/units_of_measure
      # Returns active units for dropdown selection
      def index
        units = UnitOfMeasure.ordered

        # Optionally filter by active only (default: all)
        units = units.active if params[:active] == "true"

        render json: {
          success: true,
          units: units.map { |u| unit_json(u) }
        }
      end

      # POST /api/v1/units_of_measure
      def create
        unit = UnitOfMeasure.new(unit_params)

        if unit.save
          render json: {
            success: true,
            unit: unit_json(unit),
            message: "Unit '#{unit.code}' created successfully"
          }, status: :created
        else
          render_validation_errors(unit)
        end
      end

      # PUT /api/v1/units_of_measure/:id
      def update
        if @unit.update(unit_params)
          render json: {
            success: true,
            unit: unit_json(@unit),
            message: "Unit '#{@unit.code}' updated successfully"
          }
        else
          render_validation_errors(@unit)
        end
      end

      # DELETE /api/v1/units_of_measure/:id
      def destroy
        @unit.update!(is_active: false)

        render json: {
          success: true,
          message: "Unit '#{@unit.code}' deactivated"
        }
      end

      private

      def set_unit
        @unit = UnitOfMeasure.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render_error("Unit of measure not found", status: :not_found)
      end

      def unit_params
        params.require(:unit_of_measure).permit(:code, :name, :description, :sort_order, :is_active)
      end

      def unit_json(u)
        {
          id: u.id,
          code: u.code,
          name: u.name,
          description: u.description,
          sort_order: u.sort_order,
          is_active: u.is_active,
          created_at: u.created_at,
          updated_at: u.updated_at
        }
      end
    end
  end
end
