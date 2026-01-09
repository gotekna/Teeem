module Api
  module V1
    class JobRecipesController < ApplicationController
      before_action :set_job
      before_action :set_job_recipe, only: [:show, :update, :destroy, :generate_pos, :recalculate]

      # GET /api/v1/jobs/:job_id/recipes
      def index
        job_recipes = @job.job_recipes.includes(:recipe).active

        render json: {
          success: true,
          job_recipes: job_recipes.map { |jr| job_recipe_json(jr) },
          summary: {
            total_recipes: job_recipes.count,
            total_boq: job_recipes.sum(:applied_total),
            recipes_with_po: job_recipes.with_po.count
          }
        }
      end

      # GET /api/v1/jobs/:job_id/recipes/:id
      def show
        render json: {
          success: true,
          job_recipe: job_recipe_json(@job_recipe, include_items: true)
        }
      end

      # POST /api/v1/jobs/:job_id/recipes
      # Apply a recipe to the job
      def create
        recipe = Recipe.find(params[:recipe_id])

        @job_recipe = @job.job_recipes.new(
          recipe: recipe,
          quantity_multiplier: params[:quantity_multiplier] || 1.0,
          notes: params[:notes],
          applied_by: current_user
        )

        if @job_recipe.save
          render json: {
            success: true,
            job_recipe: job_recipe_json(@job_recipe),
            message: "Recipe '#{recipe.name}' applied to job"
          }, status: :created
        else
          render json: {
            success: false,
            error: @job_recipe.errors.full_messages.join(", ")
          }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/jobs/:job_id/recipes/:id
      def update
        if @job_recipe.update(job_recipe_params)
          @job_recipe.recalculate! if params[:recalculate]

          render json: {
            success: true,
            job_recipe: job_recipe_json(@job_recipe)
          }
        else
          render json: {
            success: false,
            error: @job_recipe.errors.full_messages.join(", ")
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/jobs/:job_id/recipes/:id
      def destroy
        @job_recipe.destroy
        render json: { success: true }
      end

      # POST /api/v1/jobs/:job_id/recipes/:id/generate_pos
      # Generate purchase orders from this applied recipe
      def generate_pos
        if @job_recipe.status == 'po_generated'
          render json: {
            success: false,
            error: "Purchase orders have already been generated for this recipe"
          }, status: :unprocessable_entity
          return
        end

        begin
          purchase_orders = @job_recipe.generate_purchase_orders!(user: current_user)

          render json: {
            success: true,
            message: "Generated #{purchase_orders.count} purchase order(s)",
            purchase_orders: purchase_orders.map { |po|
              {
                id: po.id,
                po_number: po.purchase_order_number,
                supplier_name: po.supplier&.display_name,
                total: po.total
              }
            }
          }
        rescue => e
          render json: {
            success: false,
            error: e.message
          }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/jobs/:job_id/recipes/:id/recalculate
      # Recalculate totals based on current quantity variables
      def recalculate
        @job_recipe.recalculate!

        render json: {
          success: true,
          job_recipe: job_recipe_json(@job_recipe),
          message: "Recalculated successfully"
        }
      end

      # POST /api/v1/jobs/:job_id/recipes/bulk_apply
      # Apply multiple recipes at once
      def bulk_apply
        recipe_ids = params[:recipe_ids] || []
        results = []

        recipe_ids.each do |recipe_id|
          recipe = Recipe.find_by(id: recipe_id)
          next unless recipe

          job_recipe = @job.job_recipes.new(
            recipe: recipe,
            quantity_multiplier: 1.0,
            applied_by: current_user
          )

          if job_recipe.save
            results << { recipe_id: recipe_id, success: true, id: job_recipe.id }
          else
            results << { recipe_id: recipe_id, success: false, error: job_recipe.errors.full_messages.join(", ") }
          end
        end

        render json: {
          success: true,
          results: results,
          applied_count: results.count { |r| r[:success] }
        }
      end

      # GET /api/v1/jobs/:job_id/recipes/available
      # List recipes that can be applied to this job
      def available
        # Get recipes not already applied
        applied_recipe_ids = @job.job_recipes.pluck(:recipe_id)
        available_recipes = Recipe.active.where.not(id: applied_recipe_ids)

        # Search/filter if provided
        if params[:search].present?
          available_recipes = available_recipes.search(params[:search])
        end

        if params[:recipe_type].present?
          available_recipes = available_recipes.by_type(params[:recipe_type])
        end

        render json: {
          success: true,
          recipes: available_recipes.limit(50).map { |r|
            {
              id: r.id,
              code: r.code,
              name: r.name,
              recipe_type: r.recipe_type,
              cached_total: r.cached_total,
              category_name: r.recipe_category&.name,
              item_count: r.recipe_items.count
            }
          }
        }
      end

      private

      def set_job
        @job = Job.find(params[:job_id])
      end

      def set_job_recipe
        @job_recipe = @job.job_recipes.find(params[:id])
      end

      def job_recipe_params
        params.permit(:quantity_multiplier, :notes)
      end

      def job_recipe_json(job_recipe, include_items: false)
        data = {
          id: job_recipe.id,
          recipe_id: job_recipe.recipe_id,
          recipe_code: job_recipe.recipe.code,
          recipe_name: job_recipe.recipe.name,
          recipe_type: job_recipe.recipe.recipe_type,
          quantity_multiplier: job_recipe.quantity_multiplier,
          applied_total: job_recipe.applied_total,
          status: job_recipe.status,
          applied_at: job_recipe.applied_at,
          applied_by_name: job_recipe.applied_by&.name,
          notes: job_recipe.notes
        }

        if include_items
          variables = @job.quantity_variables_hash
          data[:line_items] = job_recipe.recipe.recipe_items.map do |item|
            qty = item.calculate_quantity(variables) * (job_recipe.quantity_multiplier || 1.0)
            price = item.effective_unit_price

            {
              id: item.id,
              description: item.description,
              base_quantity: item.base_quantity,
              calculated_quantity: qty,
              unit_price: price,
              line_total: qty * price,
              uses_formula: item.uses_formula,
              quantity_formula: item.quantity_formula
            }
          end
        end

        data
      end
    end
  end
end
