module Api
  module V1
    class DesignsController < ApplicationController
      before_action :set_design, only: [ :show, :update, :destroy ]

      # GET /api/v1/designs
      def index
        @designs = Design.all

        # Filter by active status
        @designs = @designs.active if params[:active] == "true"

        # Search by name
        if params[:search].present?
          @designs = @designs.where("name ILIKE ?", "%#{params[:search]}%")
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
              constructions: { only: [ :id, :title ] }
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
              constructions: { only: [ :id, :title, :status ] }
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
        if @design.constructions.any?
          return render json: {
            success: false,
            error: "Cannot delete design that is assigned to constructions"
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
