module Api
  module V1
    class UnrealVariablesController < ApplicationController
      before_action :set_unreal_variable, only: [:show, :update, :destroy]

      # GET /api/v1/unreal_variables
      def index
        @unreal_variables = UnrealVariable.all.order(:variable_name)
        render json: { unreal_variables: @unreal_variables }
      end

      # GET /api/v1/unreal_variables/:id
      def show
        render json: @unreal_variable
      end

      # POST /api/v1/unreal_variables
      def create
        @unreal_variable = UnrealVariable.new(unreal_variable_params)

        if @unreal_variable.save
          render json: @unreal_variable, status: :created
        else
          render json: { errors: @unreal_variable.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /api/v1/unreal_variables/:id
      def update
        if @unreal_variable.update(unreal_variable_params)
          render json: @unreal_variable
        else
          render json: { errors: @unreal_variable.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/unreal_variables/:id
      def destroy
        @unreal_variable.destroy
        head :no_content
      end

      private

      def set_unreal_variable
        @unreal_variable = UnrealVariable.find(params[:id])
      end

      def unreal_variable_params
        params.require(:unreal_variable).permit(:variable_name, :claude_value, :is_active)
      end
    end
  end
end
