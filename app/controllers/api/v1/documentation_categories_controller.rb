module Api
  module V1
    class DocumentationCategoriesController < ApplicationController
      before_action :authorize_request
      before_action :set_category, only: [ :show, :update, :destroy ]

      # GET /api/v1/documentation_categories
      def index
        categories = DocumentationCategory.active.ordered
        render json: { documentation_categories: categories }
      end

      # GET /api/v1/documentation_categories/:id
      def show
        render json: @category
      end

      # POST /api/v1/documentation_categories
      def create
        category = DocumentationCategory.new(category_params)

        if category.save
          render json: category, status: :created
        else
          render json: { errors: category.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /api/v1/documentation_categories/:id
      def update
        if @category.update(category_params)
          render json: @category
        else
          render json: { errors: @category.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/documentation_categories/:id
      def destroy
        @category.update(is_active: false)
        head :no_content
      end

      # POST /api/v1/documentation_categories/reorder
      def reorder
        category_orders = params[:category_orders] # [{id: 1, sequence_order: 0}, {id: 2, sequence_order: 1}]

        ActiveRecord::Base.transaction do
          category_orders.each do |category_order|
            category = DocumentationCategory.find(category_order[:id])
            category.update!(sequence_order: category_order[:sequence_order])

            # Update sequence_order for all job-specific tabs with this category name
            ConstructionDocumentationTab.where(name: category.name)
                                       .update_all(sequence_order: category_order[:sequence_order])
          end
        end

        categories = DocumentationCategory.active.ordered
        render json: { documentation_categories: categories }
      rescue ActiveRecord::RecordNotFound => e
        render json: { error: e.message }, status: :not_found
      rescue => e
        render json: { error: e.message }, status: :unprocessable_entity
      end

      private

      def set_category
        @category = DocumentationCategory.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: { error: "Documentation category not found" }, status: :not_found
      end

      def category_params
        params.require(:documentation_category).permit(
          :name,
          :icon,
          :color,
          :description,
          :folder_path,
          :sequence_order,
          :is_default,
          :is_active
        )
      end
    end
  end
end
