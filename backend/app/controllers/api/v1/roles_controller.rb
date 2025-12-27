# frozen_string_literal: true

module Api
  module V1
    class RolesController < ApplicationController
      # GET /api/v1/roles
      # Returns all active roles in order for use in select dropdowns
      def index
        roles = Role.for_select
        render json: roles
      end

      # POST /api/v1/roles
      # Creates a new role
      def create
        # Get the next position
        max_position = Role.maximum(:position) || 0

        role = Role.new(role_params)
        role.position = max_position + 1
        role.active = true

        if role.save
          render json: {
            success: true,
            role: {
              id: role.id,
              name: role.name,
              display_name: role.display_name,
              value: role.name,
              label: role.display_name
            }
          }, status: :created
        else
          render json: {
            success: false,
            errors: role.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      private

      def role_params
        params.require(:role).permit(:name, :display_name)
      end
    end
  end
end
