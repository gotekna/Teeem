module Api
  module V1
    class FoundationViewsController < ApplicationController
      before_action :set_foundation_view, only: [:show, :update, :destroy]

      # GET /api/v1/foundation_views
      # GET /api/v1/foundation_views?foundation_id=123
      def index
        # Handle both authenticated and unauthenticated requests
        # Unauthenticated users see public/system views (user_id IS NULL)
        if current_user
          views = current_user.foundation_views
        else
          views = FoundationView.where(user_id: nil)
        end

        if params[:foundation_id].present?
          views = views.where(foundation_id: params[:foundation_id])

          # Auto-create "Setup" view if no views exist for this user/foundation combination
          if current_user && views.empty?
            foundation = Foundation.find_by(id: params[:foundation_id])
            if foundation
              create_default_setup_view(foundation, current_user)
              # Reload views to include the newly created Setup view
              views = current_user.foundation_views.where(foundation_id: params[:foundation_id])
            end
          end
        end

        render json: {
          success: true,
          views: views.order(display_order: :asc, created_at: :desc)
        }
      end

      # GET /api/v1/foundation_views/:id
      def show
        render json: {
          success: true,
          view: @foundation_view
        }
      end

      # POST /api/v1/foundation_views
      def create
        unless current_user
          return render json: {
            success: false,
            error: "Authentication required to save views"
          }, status: :unauthorized
        end

        @foundation_view = current_user.foundation_views.build(foundation_view_params)

        if @foundation_view.save
          render json: {
            success: true,
            view: @foundation_view,
            message: "View saved successfully"
          }, status: :created
        else
          render json: {
            success: false,
            errors: @foundation_view.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /api/v1/foundation_views/:id
      def update
        if @foundation_view.update(foundation_view_params)
          render json: {
            success: true,
            view: @foundation_view,
            message: "View updated successfully"
          }
        else
          render json: {
            success: false,
            errors: @foundation_view.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/foundation_views/:id
      def destroy
        @foundation_view.destroy
        render json: {
          success: true,
          message: "View deleted successfully"
        }
      end

      # POST /api/v1/foundation_views/reorder
      # Bulk update display_order for views after drag-and-drop
      # GOLD STANDARD RULE: The view with display_order = 0 automatically becomes the default view
      # (enforced by FoundationView model after_save callback)
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
              view = current_user.foundation_views.find(item[:id])
              Rails.logger.info "[Reorder] Updating view #{view.id} (#{view.name}) from display_order #{view.display_order} to #{item[:display_order]}"
              view.update!(display_order: item[:display_order])
              Rails.logger.info "[Reorder] Successfully updated view #{view.id}"
            end
            # Note: The view at display_order = 0 will automatically be set as default
            # by the FoundationView model's ensure_first_view_is_default callback
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

      def set_foundation_view
        unless current_user
          return render json: {
            success: false,
            error: "Authentication required"
          }, status: :unauthorized
        end

        @foundation_view = current_user.foundation_views.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: {
          success: false,
          error: "View not found"
        }, status: :not_found
      end

      def foundation_view_params
        params.require(:foundation_view).permit(
          :foundation_id,
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

    # POST /api/v1/foundation_views/create_all_setup_views
    # Creates Setup views for all foundations that don't have one
    def create_all_setup_views
      unless current_user
        return render json: {
          success: false,
          error: "Authentication required"
        }, status: :unauthorized
      end

      results = {
        created: [],
        skipped: [],
        errors: []
      }

      # Get all foundations
      foundations = Foundation.all

      foundations.each do |foundation|
        # Check if user already has a Setup view for this foundation
        existing_setup = current_user.foundation_views.find_by(foundation_id: foundation.id, name: 'Setup')

        if existing_setup
          results[:skipped] << { foundation_id: foundation.id, foundation_name: foundation.name, reason: 'Setup view already exists' }
          next
        end

        begin
          create_default_setup_view(foundation, current_user)
          results[:created] << { foundation_id: foundation.id, foundation_name: foundation.name }
        rescue => e
          results[:errors] << { foundation_id: foundation.id, foundation_name: foundation.name, error: e.message }
        end
      end

      render json: {
        success: true,
        message: "Created #{results[:created].length} Setup views, skipped #{results[:skipped].length}, #{results[:errors].length} errors",
        results: results
      }
    end

    private

      # Auto-create the "Setup" view for foundations without saved views
      # This view serves as the default template with all columns visible
      def create_default_setup_view(foundation, user)
        # Get all columns for the foundation
        all_columns = foundation.columns.pluck(:column_name)

        # Build visible columns hash (all columns visible by default)
        visible_columns = {}
        all_columns.each { |col| visible_columns[col] = true }
        # Note: 'select' and 'actions' are UI-only pseudo-columns, not database columns
        # Only add 'id' to visible columns as it's a real database column
        visible_columns['id'] = true

        # Build column order array (includes UI-only columns for frontend display)
        column_order = ['select', 'id', 'actions'] + all_columns

        # Create the Setup view
        user.foundation_views.create!(
          foundation_id: foundation.id,
          name: 'Setup',
          view_type: 'custom',
          filters: {
            interGroupLogic: 'OR',
            cascadeFilters: [],
            filterGroups: []
          },
          columns: {
            visible: visible_columns,
            order: column_order
          },
          sort_order: [],
          group_by_column: nil,
          is_default: true,
          display_order: 0
        )

        Rails.logger.info "Created default 'Setup' view for user #{user.id}, foundation #{foundation.id} (#{foundation.name})"
      rescue => e
        Rails.logger.error "Failed to create Setup view for foundation #{foundation.id}: #{e.message}"
        # Don't fail the request if view creation fails
      end
    end
  end
end
