module Api
  module V1
    class SuburbsController < ApplicationController
      skip_before_action :authorize_request, only: [ :index, :search ]
      before_action :set_suburb, only: [ :show, :update, :destroy ]

      # GET /api/v1/suburbs
      def index
        @suburbs = Suburb.unscoped.order(:name)

        # Filter by state if provided
        @suburbs = @suburbs.where(state: params[:state]) if params[:state].present?

        # Filter by council if provided
        @suburbs = @suburbs.where(council: params[:council]) if params[:council].present?

        render json: {
          success: true,
          suburbs: @suburbs.map { |s| suburb_json(s) }
        }
      end

      # GET /api/v1/suburbs/search?q=term
      def search
        query = params[:q].to_s.strip
        if query.blank?
          render json: { success: true, suburbs: [] }
          return
        end

        @suburbs = Suburb.unscoped
          .where("name ILIKE ? OR postcode ILIKE ?", "%#{query}%", "%#{query}%")
          .order(:name)
          .limit(50)

        render json: {
          success: true,
          suburbs: @suburbs.map { |s| suburb_json(s) }
        }
      end

      # GET /api/v1/suburbs/:id
      def show
        render json: {
          success: true,
          suburb: suburb_json(@suburb)
        }
      end

      # POST /api/v1/suburbs
      def create
        @suburb = Suburb.new(suburb_params)

        if @suburb.save
          render json: {
            success: true,
            suburb: suburb_json(@suburb)
          }, status: :created
        else
          render json: {
            success: false,
            errors: @suburb.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /api/v1/suburbs/:id
      def update
        if @suburb.update(suburb_params)
          render json: {
            success: true,
            suburb: suburb_json(@suburb)
          }
        else
          render json: {
            success: false,
            errors: @suburb.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/suburbs/:id
      def destroy
        @suburb.destroy
        render json: { success: true }
      end

      # POST /api/v1/suburbs/reorder
      def reorder
        params[:suburb_ids].each_with_index do |id, index|
          Suburb.where(id: id).update_all(position: index)
        end

        render json: {
          success: true,
          suburbs: Suburb.unscoped.order(:position).map { |s| suburb_json(s) }
        }
      end

      # POST /api/v1/suburbs/bulk_update_council
      # Update council for multiple suburbs at once
      def bulk_update_council
        suburb_ids = params[:suburb_ids]
        council = params[:council]

        if suburb_ids.blank?
          render json: { success: false, error: "No suburbs specified" }, status: :unprocessable_entity
          return
        end

        updated_count = Suburb.where(id: suburb_ids).update_all(council: council)

        render json: {
          success: true,
          updated_count: updated_count,
          message: "Updated #{updated_count} suburbs"
        }
      end

      private

      def set_suburb
        @suburb = Suburb.find(params[:id])
      end

      def suburb_params
        params.require(:suburb).permit(:name, :postcode, :state, :council, :position, :is_active)
      end

      def suburb_json(suburb)
        {
          id: suburb.id,
          name: suburb.name,
          postcode: suburb.postcode,
          state: suburb.state,
          council: suburb.council,
          position: suburb.position,
          is_active: suburb.is_active,
          created_at: suburb.created_at,
          updated_at: suburb.updated_at
        }
      end
    end
  end
end
