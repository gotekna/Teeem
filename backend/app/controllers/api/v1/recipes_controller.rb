module Api
  module V1
    class RecipesController < ApplicationController
      before_action :set_recipe, only: [:show, :update, :destroy, :duplicate, :activate, :archive, :calculate]

      # GET /api/v1/recipes
      def index
        recipes = Recipe.includes(:recipe_category, :default_supplier, :recipe_items)

        # Filters
        recipes = recipes.by_type(params[:type]) if params[:type].present?
        recipes = recipes.where(status: params[:status]) if params[:status].present?
        recipes = recipes.where(recipe_category_id: params[:category_id]) if params[:category_id].present?
        recipes = recipes.search(params[:q]) if params[:q].present?

        recipes = recipes.order(:name)

        render json: { success: true, recipes: recipes.as_json }
      end

      # GET /api/v1/recipes/:id
      def show
        render json: {
          success: true,
          recipe: @recipe.as_json.merge(
            items: @recipe.recipe_items.ordered.as_json,
            versions: @recipe.recipe_versions.recent.as_json
          )
        }
      end

      # POST /api/v1/recipes
      def create
        recipe = Recipe.new(recipe_params)

        if recipe.save
          render json: { success: true, recipe: recipe.as_json }, status: :created
        else
          render json: { success: false, error: recipe.errors.full_messages.join(', ') },
                 status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/recipes/:id
      def update
        if @recipe.update(recipe_params)
          render json: { success: true, recipe: @recipe.as_json }
        else
          render json: { success: false, error: @recipe.errors.full_messages.join(', ') },
                 status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/recipes/:id
      def destroy
        @recipe.destroy
        render json: { success: true }
      end

      # POST /api/v1/recipes/:id/duplicate
      def duplicate
        new_recipe = @recipe.duplicate(
          new_code: params[:new_code],
          new_name: params[:new_name]
        )

        render json: { success: true, recipe: new_recipe.as_json }, status: :created
      rescue ActiveRecord::RecordInvalid => e
        render json: { success: false, error: e.message }, status: :unprocessable_entity
      end

      # POST /api/v1/recipes/:id/activate
      def activate
        @recipe.activate!
        render json: { success: true, recipe: @recipe.as_json }
      end

      # POST /api/v1/recipes/:id/archive
      def archive
        @recipe.archive!
        render json: { success: true, recipe: @recipe.as_json }
      end

      # POST /api/v1/recipes/:id/calculate
      # Calculate recipe totals with given quantity variable values
      def calculate
        variable_values = params[:variables] || {}

        items = @recipe.recipe_items.ordered.map do |item|
          qty = item.calculate_quantity(variable_values)
          {
            id: item.id,
            description: item.description,
            unit_of_measure: item.unit_of_measure,
            calculated_quantity: qty,
            unit_price: item.effective_unit_price,
            line_total: qty * item.effective_unit_price
          }
        end

        total = items.sum { |i| i[:line_total] }

        render json: {
          success: true,
          recipe_id: @recipe.id,
          items: items,
          total: total
        }
      end

      private

      def set_recipe
        @recipe = Recipe.find(params[:id])
      end

      def recipe_params
        params.require(:recipe).permit(
          :code, :name, :description, :recipe_type, :status,
          :recipe_category_id, :default_supplier_id, :notes,
          recipe_items_attributes: [
            :id, :description, :pricebook_item_id, :unit_of_measure,
            :cost_type, :base_quantity, :quantity_formula, :uses_formula,
            :unit_price_override, :use_pricebook_price, :sequence_order, :notes,
            :_destroy
          ]
        )
      end
    end
  end
end
