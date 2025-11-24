module Api
  module V1
    class TableViewsController < ApplicationController
      before_action :set_table_view, only: [:show, :update, :destroy]

      # GET /api/v1/table_views
      # GET /api/v1/table_views?table_id=123
      def index
        # Handle both authenticated and unauthenticated requests
        # Unauthenticated users see public/system views (user_id IS NULL)
        if current_user
          views = current_user.table_views
        else
          views = TableView.where(user_id: nil)
        end

        if params[:table_id].present?
          views = views.where(table_id: params[:table_id])
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
      # GOLD STANDARD RULE: The view with display_order = 0 automatically becomes the default view
      # (enforced by TableView model after_save callback)
      def reorder
        orders = params[:orders] # Array of {id: X, display_order: Y}

        if orders.blank?
          return render json: {
            success: false,
            error: "No orders provided"
          }, status: :unprocessable_entity
        end

        begin
          ActiveRecord::Base.transaction do
            orders.each do |item|
              view = current_user.table_views.find(item[:id])
              Rails.logger.info "[Reorder] Updating view #{view.id} (#{view.name}) from display_order #{view.display_order} to #{item[:display_order]}"
              view.update!(display_order: item[:display_order])
              Rails.logger.info "[Reorder] Successfully updated view #{view.id}"
            end
            # Note: The view at display_order = 0 will automatically be set as default
            # by the TableView model's ensure_first_view_is_default callback
          end

          render json: {
            success: true,
            message: "Views reordered successfully"
          }
        rescue ActiveRecord::RecordNotFound => e
          Rails.logger.error "[Reorder] RecordNotFound: #{e.message}"
          Rails.logger.error e.backtrace.join("\n")
          render json: {
            success: false,
            error: "One or more views not found"
          }, status: :not_found
        rescue => e
          Rails.logger.error "[Reorder] Error: #{e.class.name}: #{e.message}"
          Rails.logger.error e.backtrace.join("\n")
          render json: {
            success: false,
            error: e.message
          }, status: :unprocessable_entity
        end
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
          :group_by_column,
          filters: [
            :interGroupLogic,
            cascadeFilters: [],
            filterGroups: []
          ],
          columns: {
            order: [],
            visible: {}
          },
          sort_order: []
        )
      end
    end
  end
end
