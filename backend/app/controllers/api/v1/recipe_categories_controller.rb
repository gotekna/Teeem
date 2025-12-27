module Api
  module V1
    class RecipeCategoriesController < ApplicationController
      before_action :set_category, only: [:show, :update, :destroy]

      # GET /api/v1/recipe_categories
      def index
        categories = RecipeCategory.active.ordered

        # Return as tree structure or flat list
        if params[:format] == 'tree'
          render json: { success: true, categories: RecipeCategory.tree }
        else
          render json: { success: true, categories: categories.as_json }
        end
      end

      # GET /api/v1/recipe_categories/:id
      def show
        render json: {
          success: true,
          category: @category.as_json.merge(
            recipes: @category.recipes.active.as_json,
            children: @category.children.active.ordered.as_json
          )
        }
      end

      # POST /api/v1/recipe_categories
      def create
        category = RecipeCategory.new(category_params)

        if category.save
          render json: { success: true, category: category.as_json }, status: :created
        else
          render json: { success: false, error: category.errors.full_messages.join(', ') },
                 status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/recipe_categories/:id
      def update
        if @category.update(category_params)
          render json: { success: true, category: @category.as_json }
        else
          render json: { success: false, error: @category.errors.full_messages.join(', ') },
                 status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/recipe_categories/:id
      def destroy
        if @category.recipes.any?
          render json: { success: false, error: 'Cannot delete category with recipes' },
                 status: :unprocessable_entity
        else
          @category.destroy
          render json: { success: true }
        end
      end

      private

      def set_category
        @category = RecipeCategory.find(params[:id])
      end

      def category_params
        params.require(:recipe_category).permit(:code, :name, :description, :parent_id, :position)
      end
    end
  end
end
