module Api
  module V1
    class PlanTypesController < ApplicationController
      before_action :set_plan_category, only: [:nested_index, :create]
      before_action :set_plan_type, only: [:show, :update, :destroy]

      # GET /api/v1/plan_types
      def index
        @types = PlanType.includes(:plan_category).ordered

        # Filter by category if provided
        if params[:plan_category_id].present?
          @types = @types.where(plan_category_id: params[:plan_category_id])
        end

        render json: {
          success: true,
          data: @types.map { |t| serialize_type(t) }
        }
      end

      # GET /api/v1/plan_categories/:plan_category_id/plan_types
      def nested_index
        @types = @category.plan_types.ordered

        render json: {
          success: true,
          data: @types.map { |t| serialize_type(t) }
        }
      end

      # GET /api/v1/plan_types/:id
      def show
        render json: {
          success: true,
          data: serialize_type(@type)
        }
      end

      # POST /api/v1/plan_categories/:plan_category_id/plan_types
      def create
        @type = @category.plan_types.build(type_params)

        if @type.save
          render json: {
            success: true,
            data: serialize_type(@type)
          }, status: :created
        else
          render json: {
            success: false,
            error: @type.errors.full_messages.join(', ')
          }, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /api/v1/plan_types/:id
      def update
        if @type.update(type_params)
          render json: {
            success: true,
            data: serialize_type(@type)
          }
        else
          render json: {
            success: false,
            error: @type.errors.full_messages.join(', ')
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/plan_types/:id
      def destroy
        if @type.job_plans.exists?
          return render json: {
            success: false,
            error: 'Cannot delete plan type that is in use by jobs.'
          }, status: :unprocessable_entity
        end

        @type.destroy
        render json: { success: true }
      end

      # POST /api/v1/plan_types/reorder
      def reorder
        type_ids = params[:type_ids] || []

        type_ids.each_with_index do |id, index|
          PlanType.where(id: id).update_all(sequence_order: index)
        end

        render json: { success: true }
      end

      private

      def set_plan_category
        @category = PlanCategory.find(params[:plan_category_id])
      end

      def set_plan_type
        @type = PlanType.find(params[:id])
      end

      def type_params
        params.require(:plan_type).permit(
          :code,
          :name,
          :allows_variants,
          :notes,
          :sequence_order,
          :is_active
        )
      end

      def serialize_type(plan_type)
        {
          id: plan_type.id,
          plan_category_id: plan_type.plan_category_id,
          category_name: plan_type.plan_category&.name,
          code: plan_type.code,
          name: plan_type.name,
          display_name: plan_type.display_name,
          full_code: plan_type.full_code,
          allows_variants: plan_type.allows_variants,
          notes: plan_type.notes,
          sequence_order: plan_type.sequence_order,
          is_active: plan_type.is_active,
          job_plans_count: plan_type.job_plans.count,
          created_at: plan_type.created_at,
          updated_at: plan_type.updated_at
        }
      end
    end
  end
end
