module Api
  module V1
    class PricebookCategoriesController < ApplicationController
      before_action :set_pricebook_category, only: [:show, :update, :destroy]

      # GET /api/v1/pricebook_categories
      def index
        @categories = PricebookCategory.ordered

        # Filter by active status
        @categories = @categories.active if params[:active] == 'true'

        # Include items count if requested
        if params[:include_counts] == 'true'
          @categories = @categories.left_joins(:pricebook_items)
                                   .select('pricebook_categories.*, COUNT(pricebook_items.id) as items_count')
                                   .group('pricebook_categories.id')
        end

        render json: {
          success: true,
          categories: @categories.map { |c| category_json(c, params[:include_counts] == 'true') }
        }
      end

      # GET /api/v1/pricebook_categories/:id
      def show
        render json: {
          success: true,
          category: category_json(@pricebook_category, true)
        }
      end

      # POST /api/v1/pricebook_categories
      def create
        @pricebook_category = PricebookCategory.new(pricebook_category_params)

        if @pricebook_category.save
          render json: {
            success: true,
            category: category_json(@pricebook_category),
            message: "Category '#{@pricebook_category.name}' created successfully"
          }, status: :created
        else
          render json: {
            success: false,
            errors: @pricebook_category.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /api/v1/pricebook_categories/:id
      def update
        if @pricebook_category.update(pricebook_category_params)
          render json: {
            success: true,
            category: category_json(@pricebook_category),
            message: "Category '#{@pricebook_category.name}' updated successfully"
          }
        else
          render json: {
            success: false,
            errors: @pricebook_category.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/pricebook_categories/:id
      def destroy
        name = @pricebook_category.name
        items_count = @pricebook_category.pricebook_items.count

        if items_count > 0 && params[:force] != 'true'
          render json: {
            success: false,
            error: "Cannot delete category '#{name}' - it has #{items_count} items. Use force=true to delete anyway (items will have null category)."
          }, status: :unprocessable_entity
          return
        end

        @pricebook_category.destroy

        render json: {
          success: true,
          message: "Category '#{name}' deleted successfully"
        }
      end

      # POST /api/v1/pricebook_categories/reorder
      def reorder
        positions = params[:positions] # Expected format: { id: position, id: position, ... }

        unless positions.is_a?(Hash) || positions.is_a?(ActionController::Parameters)
          render json: { success: false, error: "Invalid positions format" }, status: :unprocessable_entity
          return
        end

        PricebookCategory.transaction do
          positions.each do |id, position|
            PricebookCategory.where(id: id).update_all(position: position.to_i)
          end
        end

        render json: {
          success: true,
          message: "Categories reordered successfully"
        }
      end

      # GET /api/v1/pricebook_categories/dropdown
      def dropdown
        categories = PricebookCategory.active.ordered

        render json: {
          success: true,
          options: categories.map { |c| { value: c.id, label: c.display_name_or_name } }
        }
      end

      private

      def set_pricebook_category
        @pricebook_category = PricebookCategory.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Category not found" }, status: :not_found
      end

      def pricebook_category_params
        params.require(:pricebook_category).permit(:name, :display_name, :color, :icon, :position, :is_active)
      end

      def category_json(category, include_count = false)
        json = {
          id: category.id,
          name: category.name,
          display_name: category.display_name,
          color: category.color,
          icon: category.icon,
          position: category.position,
          is_active: category.is_active,
          created_at: category.created_at,
          updated_at: category.updated_at
        }

        if include_count
          json[:items_count] = category.respond_to?(:items_count) && category.items_count.is_a?(Integer) ? category.items_count : category.pricebook_items.count
        end

        json
      end
    end
  end
end
