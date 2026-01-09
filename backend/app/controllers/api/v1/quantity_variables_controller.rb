module Api
  module V1
    class QuantityVariablesController < ApplicationController
      before_action :set_variable, only: [:show, :update, :destroy]

      # GET /api/v1/quantity_variables
      def index
        variables = QuantityVariable.ordered

        # Filter by category
        variables = variables.by_category(params[:category]) if params[:category].present?

        # Group by category for UI
        if params[:grouped] == 'true'
          grouped = variables.group_by(&:category).transform_values do |vars|
            vars.map(&:as_json)
          end
          render json: { success: true, variables: grouped }
        else
          render json: { success: true, variables: variables.as_json }
        end
      end

      # GET /api/v1/quantity_variables/:id
      def show
        render json: { success: true, variable: @variable.as_json }
      end

      # POST /api/v1/quantity_variables
      def create
        variable = QuantityVariable.new(variable_params)

        if variable.save
          render json: { success: true, variable: variable.as_json }, status: :created
        else
          render json: { success: false, error: variable.errors.full_messages.join(', ') },
                 status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/quantity_variables/:id
      def update
        if @variable.is_system_variable? && !current_user&.admin?
          render json: { success: false, error: 'Cannot modify system variables' },
                 status: :forbidden
          return
        end

        if @variable.update(variable_params)
          render json: { success: true, variable: @variable.as_json }
        else
          render json: { success: false, error: @variable.errors.full_messages.join(', ') },
                 status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/quantity_variables/:id
      def destroy
        if @variable.is_system_variable?
          render json: { success: false, error: 'Cannot delete system variables' },
                 status: :forbidden
        else
          @variable.destroy
          render json: { success: true }
        end
      end

      private

      def set_variable
        @variable = QuantityVariable.find(params[:id])
      end

      def variable_params
        params.require(:quantity_variable).permit(
          :variable_name, :display_name, :category, :data_type, :unit_label,
          :min_value, :max_value, :default_value, :formula, :is_computed,
          :required_for_po_generation, :position, :description,
          select_options: []
        )
      end
    end
  end
end
