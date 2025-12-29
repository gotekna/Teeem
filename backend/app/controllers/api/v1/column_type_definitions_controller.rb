# frozen_string_literal: true

module Api
  module V1
    # ColumnTypeDefinitionsController - SSoT for all column types
    #
    # This API exposes the column type definitions which are the single source
    # of truth for how columns are displayed, validated, and formatted.
    #
    # Frontend fetches these on app load and uses them to:
    # - Display values using the correct formatter
    # - Validate input using the validation_regex
    # - Apply input masks
    # - Generate clickable links
    #
    class ColumnTypeDefinitionsController < ApplicationController
      skip_before_action :authorize_request, only: [ :index, :show ]
      before_action :set_column_type_definition, only: [ :show, :update, :destroy ]
      before_action :require_admin!, only: [ :create, :update, :destroy ]

      # GET /api/v1/column_type_definitions
      # Returns all active column type definitions
      def index
        @definitions = ColumnTypeDefinition.where(is_active: true).order(:category, :display_name)

        render json: {
          success: true,
          data: @definitions.map { |d| definition_json(d) },
          meta: {
            total: @definitions.count,
            categories: @definitions.pluck(:category).uniq.compact
          }
        }
      end

      # GET /api/v1/column_type_definitions/:id
      # Returns a single column type definition by ID or type_key
      def show
        render json: {
          success: true,
          data: definition_json(@definition)
        }
      end

      # POST /api/v1/column_type_definitions
      # Creates a new column type definition (admin only)
      def create
        @definition = ColumnTypeDefinition.new(definition_params)

        if @definition.save
          render json: {
            success: true,
            data: definition_json(@definition),
            message: "Column type definition created successfully"
          }, status: :created
        else
          render json: {
            success: false,
            error: @definition.errors.full_messages.join(", ")
          }, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /api/v1/column_type_definitions/:id
      # Updates a column type definition (admin only)
      def update
        if @definition.update(definition_params)
          # Increment version if significant fields changed
          if definition_params.keys.any? { |k| significant_field?(k) }
            @definition.increment_version!
          end

          render json: {
            success: true,
            data: definition_json(@definition),
            message: "Column type definition updated successfully"
          }
        else
          render json: {
            success: false,
            error: @definition.errors.full_messages.join(", ")
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/column_type_definitions/:id
      # Soft-deletes a column type definition (admin only)
      def destroy
        # Check if any columns are using this type
        if @definition.columns.exists?
          render json: {
            success: false,
            error: "Cannot delete type definition that is in use by #{@definition.columns.count} column(s)"
          }, status: :unprocessable_entity
          return
        end

        # Soft delete by marking inactive
        @definition.update!(is_active: false)

        render json: {
          success: true,
          message: "Column type definition deactivated successfully"
        }
      end

      private

      def set_column_type_definition
        # Allow lookup by ID or type_key
        @definition = if params[:id].to_s.match?(/^\d+$/)
          ColumnTypeDefinition.find(params[:id])
        else
          ColumnTypeDefinition.find_by!(type_key: params[:id])
        end
      end

      def definition_params
        params.require(:column_type_definition).permit(
          :type_key,
          :display_name,
          :category,
          :sql_type,
          :rails_type,
          :default_max_length,
          :default_min_length,
          :default_min_value,
          :default_max_value,
          :validation_regex,
          :validation_message,
          :display_formatter,
          :display_format,
          :link_template,
          :input_mask,
          :example_values,
          :used_for,
          :icon,
          :emoji,
          :needs_config,
          :is_active,
          :locale
        )
      end

      def significant_field?(field)
        # Fields that affect how columns behave
        %w[
          validation_regex validation_message
          display_formatter display_format
          default_max_length default_min_length
          default_min_value default_max_value
          sql_type
        ].include?(field.to_s)
      end

      def require_admin!
        unless current_user&.admin?
          render json: {
            success: false,
            error: "Admin access required"
          }, status: :forbidden
        end
      end

      def definition_json(definition)
        {
          id: definition.id,
          type_key: definition.type_key,
          display_name: definition.display_name,
          category: definition.category,
          sql_type: definition.sql_type,
          rails_type: definition.rails_type,

          # Validation
          validation_regex: definition.validation_regex,
          validation_message: definition.validation_message,
          default_max_length: definition.default_max_length,
          default_min_length: definition.default_min_length,
          default_min_value: definition.default_min_value,
          default_max_value: definition.default_max_value,

          # Display
          display_formatter: definition.display_formatter,
          display_format: definition.display_format,
          link_template: definition.link_template,
          input_mask: definition.input_mask,
          locale: definition.locale,

          # Meta
          icon: definition.icon,
          emoji: definition.emoji,
          example_values: definition.example_values,
          used_for: definition.used_for,
          needs_config: definition.needs_config,
          is_active: definition.is_active,
          version: definition.version,

          # Stats
          column_count: definition.column_count,
          compliance_percentage: definition.compliance_percentage
        }
      end
    end
  end
end
