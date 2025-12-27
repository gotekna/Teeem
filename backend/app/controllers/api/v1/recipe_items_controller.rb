module Api
  module V1
    class RecipeItemsController < ApplicationController
      before_action :set_recipe
      before_action :set_recipe_item, only: [:show, :update, :destroy]

      # GET /api/v1/recipes/:recipe_id/items
      def index
        items = @recipe.recipe_items.ordered.includes(:pricebook_item)

        render json: {
          success: true,
          items: items.as_json
        }
      end

      # GET /api/v1/recipes/:recipe_id/items/:id
      def show
        render json: {
          success: true,
          item: @recipe_item.as_json
        }
      end

      # POST /api/v1/recipes/:recipe_id/items
      def create
        @recipe_item = @recipe.recipe_items.new(recipe_item_params)

        # Set sequence order to end if not specified
        if @recipe_item.sequence_order.blank?
          max_order = @recipe.recipe_items.maximum(:sequence_order) || 0
          @recipe_item.sequence_order = max_order + 1
        end

        if @recipe_item.save
          render json: {
            success: true,
            item: @recipe_item.as_json
          }, status: :created
        else
          render json: {
            success: false,
            error: @recipe_item.errors.full_messages.join(", ")
          }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/recipes/:recipe_id/items/:id
      def update
        if @recipe_item.update(recipe_item_params)
          render json: {
            success: true,
            item: @recipe_item.as_json
          }
        else
          render json: {
            success: false,
            error: @recipe_item.errors.full_messages.join(", ")
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/recipes/:recipe_id/items/:id
      def destroy
        @recipe_item.destroy
        render json: { success: true }
      end

      # POST /api/v1/recipes/:recipe_id/items/reorder
      # Accepts { item_ids: [1, 3, 2, 4] } - array of item IDs in new order
      def reorder
        item_ids = params[:item_ids] || []

        ActiveRecord::Base.transaction do
          item_ids.each_with_index do |id, index|
            @recipe.recipe_items.where(id: id).update_all(sequence_order: index + 1)
          end
        end

        render json: {
          success: true,
          items: @recipe.recipe_items.ordered.as_json
        }
      end

      # POST /api/v1/recipes/:recipe_id/items/bulk_create
      # Create multiple items at once (for pasting from spreadsheet)
      def bulk_create
        items_params = params[:items] || []
        created_items = []
        errors = []

        max_order = @recipe.recipe_items.maximum(:sequence_order) || 0

        ActiveRecord::Base.transaction do
          items_params.each_with_index do |item_params, index|
            item = @recipe.recipe_items.new(
              item_params.permit(
                :description, :pricebook_item_id, :unit_of_measure, :cost_type,
                :base_quantity, :quantity_formula, :uses_formula,
                :unit_price_override, :use_pricebook_price, :notes
              )
            )
            item.sequence_order = max_order + index + 1

            if item.save
              created_items << item
            else
              errors << { index: index, errors: item.errors.full_messages }
            end
          end

          # Rollback if any errors
          raise ActiveRecord::Rollback if errors.any?
        end

        if errors.empty?
          render json: {
            success: true,
            items: created_items.map(&:as_json)
          }, status: :created
        else
          render json: {
            success: false,
            errors: errors
          }, status: :unprocessable_entity
        end
      end

      private

      def set_recipe
        @recipe = Recipe.find(params[:recipe_id])
      end

      def set_recipe_item
        @recipe_item = @recipe.recipe_items.find(params[:id])
      end

      def recipe_item_params
        params.require(:recipe_item).permit(
          :description, :pricebook_item_id, :unit_of_measure, :cost_type,
          :base_quantity, :quantity_formula, :uses_formula,
          :unit_price_override, :use_pricebook_price, :sequence_order, :notes
        )
      end
    end
  end
end
