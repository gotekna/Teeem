module Api
  module V1
    class TableViewsController < ApplicationController
      before_action :set_table_view, only: [:show, :update, :destroy]

      # GET /api/v1/table_views
      # GET /api/v1/table_views?table_id=123
      def index
        views = current_user.table_views

        if params[:table_id].present?
          views = views.for_table(params[:table_id])
        end

        render json: {
          success: true,
          views: views.order(display_order: :asc, created_at: :desc)
        }
      end

      # GET /api/v1/table_views/:id
      def show
        render json: {
          success: true,
          view: @table_view
        }
      end

      # POST /api/v1/table_views
      def create
        @table_view = current_user.table_views.build(table_view_params)

        if @table_view.save
          render json: {
            success: true,
            view: @table_view,
            message: "View saved successfully"
          }, status: :created
        else
          render json: {
            success: false,
            errors: @table_view.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /api/v1/table_views/:id
      def update
        if @table_view.update(table_view_params)
          render json: {
            success: true,
            view: @table_view,
            message: "View updated successfully"
          }
        else
          render json: {
            success: false,
            errors: @table_view.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/table_views/:id
      def destroy
        @table_view.destroy
        render json: {
          success: true,
          message: "View deleted successfully"
        }
      end

      # POST /api/v1/table_views/reorder
      # Bulk update display_order for views after drag-and-drop
      def reorder
        orders = params[:orders] # Array of {id: X, display_order: Y}

        if orders.blank?
          return render json: {
            success: false,
            error: "No orders provided"
          }, status: :unprocessable_entity
        end

        ActiveRecord::Base.transaction do
          orders.each do |item|
            view = current_user.table_views.find(item[:id])
            view.update!(display_order: item[:display_order])
          end
        end

        render json: {
          success: true,
          message: "Views reordered successfully"
        }
      rescue ActiveRecord::RecordNotFound
        render json: {
          success: false,
          error: "One or more views not found"
        }, status: :not_found
      rescue => e
        render json: {
          success: false,
          error: e.message
        }, status: :unprocessable_entity
      end

      private

      def set_table_view
        @table_view = current_user.table_views.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: {
          success: false,
          error: "View not found"
        }, status: :not_found
      end

      def table_view_params
        params.require(:table_view).permit(
          :table_id,
          :name,
          :view_type,
          :is_default,
          :display_order,
          filters: [
            :interGroupLogic,
            cascadeFilters: [],
            filterGroups: []
          ],
          columns: [
            :order,
            visible: {}
          ],
          sort_order: []
        )
      end
    end
  end
end
