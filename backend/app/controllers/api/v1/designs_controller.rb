module Api
  module V1
    class DesignsController < ApplicationController
      before_action :set_design, only: [ :show, :update, :destroy ]

      # GET /api/v1/designs
      def index
        @designs = Design.all

        # Filter by active status
        @designs = @designs.active if params[:active] == "true"

        # Search using SSoT SearchService
        if params[:search].present?
          @designs = SearchService.apply(
            @designs,
            params[:search],
            columns: %w[name],
            mode: params[:search_mode] || 'contains',
            model: Design
          )
        end

        # Sorting
        case params[:sort_by]
        when "size"
          @designs = @designs.by_size
        else
          @designs = @designs.by_name
        end

        render json: {
          success: true,
          designs: @designs.as_json(
            include: {
              constructions: {}
            }
          )
        }
      end

      # GET /api/v1/designs/:id
      def show
        render json: {
          success: true,
          design: @design.as_json(
            include: {
              constructions: {}
            }
          )
        }
      end

      # POST /api/v1/designs
      def create
        @design = Design.new(design_params)

        if @design.save
          render json: { success: true, design: @design }, status: :created
        else
          render json: { success: false, errors: @design.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/designs/:id
      def update
        if @design.update(design_params)
          render json: { success: true, design: @design }
        else
          render json: { success: false, errors: @design.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/designs/:id
      # Soft delete - set is_active to false
      def destroy
        if @design.jobs.any?
          return render json: {
            success: false,
            error: "Cannot delete design that is assigned to jobs"
          }, status: :unprocessable_entity
        end

        @design.update(is_active: false)
        render json: { success: true }
      end

      private

      def set_design
        @design = Design.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Design not found" }, status: :not_found
      end

      def design_params
        params.require(:design).permit(
          :name,
          :size,
          :frontage_required,
          :floor_plan_url,
          :description,
          :is_active
        )
      end
    end
  end
end
