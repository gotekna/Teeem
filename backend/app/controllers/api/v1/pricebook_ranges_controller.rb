module Api
  module V1
    class PricebookRangesController < ApplicationController
      before_action :set_pricebook_range, only: [ :show, :update, :destroy ]

      # GET /api/v1/pricebook_ranges
      def index
        @ranges = PricebookRange.ordered

        # Filter by active status
        @ranges = @ranges.active if params[:active] == "true"

        # Include items count if requested
        if params[:include_counts] == "true"
          @ranges = @ranges.left_joins(:pricebook_items)
                           .select("pricebook_ranges.*, COUNT(pricebooks.id) as items_count")
                           .group("pricebook_ranges.id")
        end

        render json: {
          success: true,
          ranges: @ranges.map { |r| range_json(r, params[:include_counts] == "true") }
        }
      end

      # GET /api/v1/pricebook_ranges/:id
      def show
        render json: {
          success: true,
          range: range_json(@pricebook_range, true)
        }
      end

      # POST /api/v1/pricebook_ranges
      def create
        @pricebook_range = PricebookRange.new(pricebook_range_params)

        if @pricebook_range.save
          render json: {
            success: true,
            range: range_json(@pricebook_range),
            message: "Range '#{@pricebook_range.name}' created successfully"
          }, status: :created
        else
          render_validation_errors(@pricebook_range)
        end
      end

      # PATCH/PUT /api/v1/pricebook_ranges/:id
      def update
        if @pricebook_range.update(pricebook_range_params)
          render json: {
            success: true,
            range: range_json(@pricebook_range),
            message: "Range '#{@pricebook_range.name}' updated successfully"
          }
        else
          render_validation_errors(@pricebook_range)
        end
      end

      # DELETE /api/v1/pricebook_ranges/:id
      def destroy
        name = @pricebook_range.name
        items_count = @pricebook_range.pricebook_items.count

        if items_count > 0 && params[:force] != "true"
          render_error("Cannot delete range '#{name}' - it has #{items_count} items. Use force=true to delete anyway (items will have null range).", status: :unprocessable_entity)
          return
        end

        @pricebook_range.destroy

        render json: {
          success: true,
          message: "Range '#{name}' deleted successfully"
        }
      end

      # POST /api/v1/pricebook_ranges/reorder
      def reorder
        positions = params[:positions]

        unless positions.is_a?(Hash) || positions.is_a?(ActionController::Parameters)
          render_error("Invalid positions format", status: :unprocessable_entity)
          return
        end

        PricebookRange.transaction do
          positions.each do |id, position|
            PricebookRange.where(id: id).update_all(position: position.to_i)
          end
        end

        render json: {
          success: true,
          message: "Ranges reordered successfully"
        }
      end

      # GET /api/v1/pricebook_ranges/dropdown
      def dropdown
        ranges = PricebookRange.active.ordered

        render json: {
          success: true,
          options: ranges.map { |r| { value: r.id, label: r.display_name_or_name } }
        }
      end

      private

      def set_pricebook_range
        @pricebook_range = PricebookRange.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render_error("Range not found", status: :not_found)
      end

      def pricebook_range_params
        params.require(:pricebook_range).permit(:name, :display_name, :color, :icon, :position, :is_active)
      end

      def range_json(range, include_count = false)
        json = {
          id: range.id,
          name: range.name,
          display_name: range.display_name,
          color: range.color,
          icon: range.icon,
          position: range.position,
          is_active: range.is_active,
          created_at: range.created_at,
          updated_at: range.updated_at
        }

        if include_count
          json[:items_count] = range.respond_to?(:items_count) && range.items_count.is_a?(Integer) ? range.items_count : range.pricebook_items.count
        end

        json
      end
    end
  end
end
