module Api
  module V1
    class JobQuantityVariablesController < ApplicationController
      before_action :set_job

      # GET /api/v1/jobs/:job_id/quantity_variables
      # Returns all variables with job-specific values (or defaults)
      def index
        variables = QuantityVariable.ordered

        # Get job's current values
        job_values = @job.job_quantity_variables.includes(:quantity_variable).index_by do |jqv|
          jqv.quantity_variable.variable_name
        end

        result = variables.map do |var|
          jqv = job_values[var.variable_name]
          {
            id: var.id,
            variable_name: var.variable_name,
            display_name: var.display_name,
            category: var.category,
            data_type: var.data_type,
            unit_label: var.unit_label,
            value: jqv ? jqv.typed_value : var.typed_default,
            is_default: jqv.nil?,
            select_options: var.select_options,
            min_value: var.min_value,
            max_value: var.max_value,
            description: var.description,
            updated_at: jqv&.updated_at,
            updated_by: jqv&.updated_by&.full_name
          }
        end

        # Group by category for UI
        if params[:grouped] == 'true'
          grouped = result.group_by { |v| v[:category] }
          render json: { success: true, variables: grouped }
        else
          render json: { success: true, variables: result }
        end
      end

      # PATCH /api/v1/jobs/:job_id/quantity_variables
      # Bulk update job quantity variables
      def update
        updates = params[:variables] || {}

        ActiveRecord::Base.transaction do
          updates.each do |variable_name, value|
            @job.set_quantity_variable(variable_name, value, updated_by: current_user)
          end
        end

        render json: {
          success: true,
          values: @job.quantity_variable_values
        }
      rescue ActiveRecord::RecordNotFound => e
        render json: { success: false, error: e.message }, status: :not_found
      rescue ActiveRecord::RecordInvalid => e
        render json: { success: false, error: e.message }, status: :unprocessable_entity
      end

      # POST /api/v1/jobs/:job_id/quantity_variables/calculate
      # Calculate all computed variables and recipe totals
      def calculate
        values = @job.quantity_variable_values

        # Calculate recipe totals if requested
        recipe_totals = {}
        if params[:recipe_ids].present?
          Recipe.where(id: params[:recipe_ids]).each do |recipe|
            items = recipe.calculate_for_job(@job)
            recipe_totals[recipe.id] = {
              name: recipe.name,
              items: items.map { |i| { description: i[:item].description, qty: i[:calculated_quantity], total: i[:line_total] } },
              total: items.sum { |i| i[:line_total] }
            }
          end
        end

        render json: {
          success: true,
          values: values,
          recipe_totals: recipe_totals
        }
      end

      private

      def set_job
        @job = Job.find(params[:job_id])
      end
    end
  end
end
