module Api
  module V1
    class PricebookBrandsController < ApplicationController
      before_action :set_pricebook_brand, only: [ :show, :update, :destroy ]

      # GET /api/v1/pricebook_brands
      def index
        @brands = PricebookBrand.ordered

        # Filter by active status
        @brands = @brands.active if params[:active] == "true"

        # Include items count if requested
        if params[:include_counts] == "true"
          @brands = @brands.left_joins(:pricebook_items)
                           .select("pricebook_brands.*, COUNT(pricebooks.id) as items_count")
                           .group("pricebook_brands.id")
        end

        render json: {
          success: true,
          brands: @brands.map { |b| brand_json(b, params[:include_counts] == "true") }
        }
      end

      # GET /api/v1/pricebook_brands/:id
      def show
        render json: {
          success: true,
          brand: brand_json(@pricebook_brand, true)
        }
      end

      # POST /api/v1/pricebook_brands
      def create
        @pricebook_brand = PricebookBrand.new(pricebook_brand_params)

        if @pricebook_brand.save
          render json: {
            success: true,
            brand: brand_json(@pricebook_brand),
            message: "Brand '#{@pricebook_brand.name}' created successfully"
          }, status: :created
        else
          render_validation_errors(@pricebook_brand)
        end
      end

      # PATCH/PUT /api/v1/pricebook_brands/:id
      def update
        if @pricebook_brand.update(pricebook_brand_params)
          render json: {
            success: true,
            brand: brand_json(@pricebook_brand),
            message: "Brand '#{@pricebook_brand.name}' updated successfully"
          }
        else
          render_validation_errors(@pricebook_brand)
        end
      end

      # DELETE /api/v1/pricebook_brands/:id
      def destroy
        name = @pricebook_brand.name
        items_count = @pricebook_brand.pricebook_items.count

        if items_count > 0 && params[:force] != "true"
          render_error("Cannot delete brand '#{name}' - it has #{items_count} items. Use force=true to delete anyway (items will have null brand).", status: :unprocessable_entity)
          return
        end

        @pricebook_brand.destroy

        render json: {
          success: true,
          message: "Brand '#{name}' deleted successfully"
        }
      end

      # POST /api/v1/pricebook_brands/reorder
      def reorder
        positions = params[:positions]

        unless positions.is_a?(Hash) || positions.is_a?(ActionController::Parameters)
          render_error("Invalid positions format", status: :unprocessable_entity)
          return
        end

        PricebookBrand.transaction do
          positions.each do |id, position|
            PricebookBrand.where(id: id).update_all(position: position.to_i)
          end
        end

        render json: {
          success: true,
          message: "Brands reordered successfully"
        }
      end

      # GET /api/v1/pricebook_brands/dropdown
      def dropdown
        brands = PricebookBrand.active.ordered

        render json: {
          success: true,
          options: brands.map { |b| { value: b.id, label: b.display_name_or_name } }
        }
      end

      private

      def set_pricebook_brand
        @pricebook_brand = PricebookBrand.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render_error("Brand not found", status: :not_found)
      end

      def pricebook_brand_params
        params.require(:pricebook_brand).permit(:name, :display_name, :color, :icon, :position, :is_active)
      end

      def brand_json(brand, include_count = false)
        json = {
          id: brand.id,
          name: brand.name,
          display_name: brand.display_name,
          color: brand.color,
          icon: brand.icon,
          position: brand.position,
          is_active: brand.is_active,
          created_at: brand.created_at,
          updated_at: brand.updated_at
        }

        if include_count
          json[:items_count] = brand.respond_to?(:items_count) && brand.items_count.is_a?(Integer) ? brand.items_count : brand.pricebook_items.count
        end

        json
      end
    end
  end
end
