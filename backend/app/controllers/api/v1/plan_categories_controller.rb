module Api
  module V1
    class PlanCategoriesController < ApplicationController
      before_action :set_plan_category, only: [:show, :update, :destroy]

      # GET /api/v1/plan_categories
      def index
        @categories = PlanCategory.includes(:plan_types).ordered

        render json: {
          success: true,
          data: @categories.map { |cat| serialize_category(cat) }
        }
      end

      # GET /api/v1/plan_categories/:id
      def show
        render json: {
          success: true,
          data: serialize_category(@category, include_types: true)
        }
      end

      # POST /api/v1/plan_categories
      def create
        @category = PlanCategory.new(category_params)

        if @category.save
          render json: {
            success: true,
            data: serialize_category(@category)
          }, status: :created
        else
          render json: {
            success: false,
            error: @category.errors.full_messages.join(', ')
          }, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /api/v1/plan_categories/:id
      def update
        if @category.update(category_params)
          render json: {
            success: true,
            data: serialize_category(@category)
          }
        else
          render json: {
            success: false,
            error: @category.errors.full_messages.join(', ')
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/plan_categories/:id
      def destroy
        if @category.plan_types.exists?
          return render json: {
            success: false,
            error: 'Cannot delete category with existing plan types. Delete the plan types first.'
          }, status: :unprocessable_entity
        end

        @category.destroy
        render json: { success: true }
      end

      # POST /api/v1/plan_categories/reorder
      def reorder
        category_ids = params[:category_ids] || []

        category_ids.each_with_index do |id, index|
          PlanCategory.where(id: id).update_all(sequence_order: index)
        end

        render json: { success: true }
      end

      private

      def set_plan_category
        @category = PlanCategory.find(params[:id])
      end

      def category_params
        params.require(:plan_category).permit(:name, :code, :sequence_order, :is_active)
      end

      def serialize_category(category, include_types: false)
        data = {
          id: category.id,
          name: category.name,
          code: category.code,
          sequence_order: category.sequence_order,
          is_active: category.is_active,
          plan_types_count: category.plan_types.count,
          created_at: category.created_at,
          updated_at: category.updated_at
        }

        if include_types
          data[:plan_types] = category.plan_types.ordered.map { |pt| serialize_type(pt) }
        end

        data
      end

      def serialize_type(plan_type)
        {
          id: plan_type.id,
          plan_category_id: plan_type.plan_category_id,
          code: plan_type.code,
          name: plan_type.name,
          display_name: plan_type.display_name,
          allows_variants: plan_type.allows_variants,
          notes: plan_type.notes,
          sequence_order: plan_type.sequence_order,
          is_active: plan_type.is_active
        }
      end
    end
  end
end
