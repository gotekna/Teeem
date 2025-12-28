module Api
  module V1
    class FoundationViewsController < ApplicationController
      skip_before_action :authorize_request, only: [ :index ]  # Allow unauthenticated access to read views (global views visible to all)
      before_action :set_current_user_if_token_present, only: [ :index ]  # Try to get current user from token if provided
      before_action :set_foundation_view, only: [ :show, :update, :destroy ]

      # GET /api/v1/foundation_views
      # GET /api/v1/foundation_views?foundation_id=123
      # GET /api/v1/foundation_views?foundation_id=218&include_views_from=426 (inherit global views from related foundations)
      # GET /api/v1/table_views?table_id=123 (backward compatible)
      def index
        # Support both foundation_id and table_id (backward compatibility)
        raw_filter_id = params[:foundation_id] || params[:table_id]

        # Resolve foundation_id from slug or numeric ID (SSoT: resolve_foundation_id helper)
        # This fixes views not loading when using slug like "sm_trades" instead of numeric ID 542
        resolved_filter_id = raw_filter_id.present? ? resolve_foundation_id(raw_filter_id) : nil

        # Support inheriting global views from related foundations
        # Example: SM Tasks (218) can inherit global views from Schedule Master (426)
        include_from_ids = params[:include_views_from].to_s.split(",").map { |id| resolve_foundation_id(id) }.compact

        # Get global views (shared by all users)
        global_views = FoundationView.global_views
        if resolved_filter_id.present?
          # Include views from both the primary foundation AND related foundations
          all_foundation_ids = [ resolved_filter_id ] + include_from_ids
          global_views = global_views.where(foundation_id: all_foundation_ids)
        end

        # Get user-specific views if authenticated
        user_views = if current_user
          views = current_user.foundation_views.personal_views
          views = views.where(foundation_id: resolved_filter_id) if resolved_filter_id.present?

          # Auto-create "Setup" view if no views exist for this user/foundation combination
          if resolved_filter_id.present? && views.empty? && global_views.empty?
            foundation = Foundation.find_by(id: resolved_filter_id)
            if foundation
              create_default_setup_view(foundation, current_user)
              # Reload views to include the newly created Setup view
              views = current_user.foundation_views.personal_views.where(foundation_id: resolved_filter_id)
            end
          end
          views
        else
          FoundationView.none
        end

        # Combine global views (first) and user views (second)
        all_views = (global_views.to_a + user_views.to_a).uniq

        # Sort by display_order first (allows user reordering), then by is_global as tiebreaker
        render json: {
          success: true,
          views: all_views.sort_by { |v| [ v.display_order || 999, v.is_global? ? 0 : 1, v.created_at ] }
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

        # Get params and resolve foundation_id (supports both slug and numeric ID)
        view_params = foundation_view_params
        if view_params[:foundation_id].present?
          resolved_id = resolve_foundation_id(view_params[:foundation_id])
          unless resolved_id
            return render json: {
              success: false,
              error: "Foundation not found for: #{view_params[:foundation_id]}"
            }, status: :not_found
          end
          view_params = view_params.merge(foundation_id: resolved_id)
        end

        @foundation_view = current_user.foundation_views.build(view_params)

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
      # NOTE: foundation_id is explicitly excluded from updates - it's IMMUTABLE after creation
      # This prevents the bug where views become invisible (foundation_id accidentally cleared to 0)
      def update
        if @foundation_view.update(foundation_view_update_params)
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
              # Try to find the view - check user's views first, then global views
              view = current_user.foundation_views.find_by(id: item[:id])
              view ||= FoundationView.global_views.find_by(id: item[:id])

              raise ActiveRecord::RecordNotFound, "View #{item[:id]} not found" unless view

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

      # POST /api/v1/foundation_views/save_global
      # Save current view configuration as a global view (visible to all users)
      # Only authenticated users can save global views
      def save_global
        unless current_user
          return render json: {
            success: false,
            error: "Authentication required to save global views"
          }, status: :unauthorized
        end

        # Support both nested foundation_view params (from frontend) and direct params (backward compatibility)
        view_data = params[:foundation_view] || params
        raw_foundation_id = view_data[:foundation_id]
        view_name = view_data[:name] || "Default View"

        unless raw_foundation_id
          return render json: {
            success: false,
            error: "foundation_id is required"
          }, status: :unprocessable_entity
        end

        # Resolve slug to numeric ID (supports both "sm_trades" slug and numeric 531)
        foundation_id = resolve_foundation_id(raw_foundation_id)
        unless foundation_id
          return render json: {
            success: false,
            error: "Foundation not found for: #{raw_foundation_id}"
          }, status: :not_found
        end

        # Always create a NEW global view (allow multiple global views per foundation)
        # Get the highest display_order for global views to insert new view at position 0
        max_display_order = FoundationView.global_views
                                     .where(foundation_id: foundation_id)
                                     .maximum(:display_order) || -1

        # Shift existing global views down
        FoundationView.global_views
                 .where(foundation_id: foundation_id)
                 .update_all("display_order = display_order + 1")

        view_params = {
          foundation_id: foundation_id,
          name: view_name,
          view_type: view_data[:view_type] || "custom",
          filters: view_data[:filters] || {},
          columns: view_data[:columns] || {},
          sort_order: view_data[:sort_order] || [],
          group_by_column: view_data[:group_by_column],
          group_by_columns: view_data[:group_by_columns] || [],
          is_global: true,
          user_id: nil,  # Global views have no user
          is_default: false,  # Don't auto-set as default, let position determine that
          display_order: 0  # Insert at the top
        }

        # Create new global view
        global_view = FoundationView.new(view_params)
        if global_view.save
          render json: {
            success: true,
            view: global_view,
            message: "Global view '#{view_name}' created successfully. All users will see this view."
          }, status: :created
        else
          render json: {
            success: false,
            errors: global_view.errors.full_messages
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

        # Support both numeric ID and slug for view lookup
        identifier = params[:id]

        # Try to find in user's personal views first, then in global views
        if identifier.to_s.match?(/\A\d+\z/)
          # Numeric ID lookup
          @foundation_view = current_user.foundation_views.find_by(id: identifier) ||
                            FoundationView.global_views.find_by(id: identifier)
        else
          # Slug lookup - need foundation context for uniqueness
          foundation_id = params[:foundation_id].present? ? resolve_foundation_id(params[:foundation_id]) : nil
          scope = foundation_id ? FoundationView.where(foundation_id: foundation_id) : FoundationView.all
          @foundation_view = scope.find_by(slug: identifier)
        end

        unless @foundation_view
          render json: {
            success: false,
            error: "View not found"
          }, status: :not_found
        end
      end

      def foundation_view_params
        params.require(:foundation_view).permit(
          :foundation_id,
          :name,
          :view_type,
          :view_display_type,
          :is_default,
          :display_order,
          :group_by_column,
          filters: {},  # Allow arbitrary hash structure for complex filters
          columns: {},  # Allow arbitrary hash structure for columns config
          sort_order: [ :column, :dir ],
          group_by_columns: []
        ).tap do |permitted|
          # Manually permit complex nested structures that Rails strong params can't handle
          if params[:foundation_view][:filters].present?
            permitted[:filters] = params[:foundation_view][:filters].to_unsafe_h
          end
          if params[:foundation_view][:columns].present?
            permitted[:columns] = params[:foundation_view][:columns].to_unsafe_h
          end
          if params[:foundation_view][:sort_order].present?
            permitted[:sort_order] = params[:foundation_view][:sort_order].map(&:to_unsafe_h)
          end
          if params[:foundation_view][:group_by_columns].present?
            permitted[:group_by_columns] = params[:foundation_view][:group_by_columns].to_a
          end
        end
      end

      # Params for UPDATE only - explicitly excludes foundation_id which is IMMUTABLE
      # CRITICAL: foundation_id cannot be changed after creation to prevent orphaned views
      def foundation_view_update_params
        params.require(:foundation_view).permit(
          # NOTE: foundation_id intentionally excluded - it's immutable after creation
          :name,
          :view_type,
          :view_display_type,
          :is_default,
          :display_order,
          :group_by_column,
          filters: {},
          columns: {},
          sort_order: [ :column, :dir ],
          group_by_columns: []
        ).tap do |permitted|
          if params[:foundation_view][:filters].present?
            permitted[:filters] = params[:foundation_view][:filters].to_unsafe_h
          end
          if params[:foundation_view][:columns].present?
            permitted[:columns] = params[:foundation_view][:columns].to_unsafe_h
          end
          if params[:foundation_view][:sort_order].present?
            permitted[:sort_order] = params[:foundation_view][:sort_order].map(&:to_unsafe_h)
          end
          if params[:foundation_view][:group_by_columns].present?
            permitted[:group_by_columns] = params[:foundation_view][:group_by_columns].to_a
          end
        end
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
        existing_setup = current_user.foundation_views.find_by(foundation_id: foundation.id, name: "Setup")

        if existing_setup
          results[:skipped] << { foundation_id: foundation.id, foundation_name: foundation.name, reason: "Setup view already exists" }
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

      # Resolve foundation_id from either numeric ID or string slug
      # Returns the numeric ID, or nil if not found
      def resolve_foundation_id(id_or_slug)
        return nil if id_or_slug.blank?

        # If it's already a valid integer, return it
        if id_or_slug.to_s == id_or_slug.to_i.to_s && id_or_slug.to_i > 0
          return id_or_slug.to_i
        end

        # Otherwise, treat as slug and look up
        foundation = Foundation.find_by(slug: id_or_slug)
        foundation&.id
      end

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
        visible_columns["id"] = true

        # Build column order array (includes UI-only columns for frontend display)
        column_order = [ "select", "id", "actions" ] + all_columns

        # Create the Setup view
        user.foundation_views.create!(
          foundation_id: foundation.id,
          name: "Setup",
          view_type: "custom",
          filters: {
            interGroupLogic: "OR",
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
