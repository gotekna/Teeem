module Api
  module V1
    class NavigationController < ApplicationController
      # GET /api/v1/navigation
      # Returns navigation from SSoT (NavigationItem) with user's collapse preferences
      def index
        # Sync user's collapse prefs for any new items added by admin
        UserNavigationConfig.sync_for_user(current_user)

        # Get user's collapse preferences
        collapse_prefs = current_user.user_navigation_configs
                           .pluck(:navigation_item_id, :is_collapsed)
                           .to_h

        # Get items from SSoT (NavigationItem), ordered by admin-set position
        items = NavigationItem.active.top_level.ordered
                  .includes(:children)
                  .select { |item| item.visible_to?(current_user) }

        render json: {
          success: true,
          navigation: {
            items: items.map { |item| item_with_children_json(item, collapse_prefs) }
          }
        }
      end

      # PATCH /api/v1/navigation/:id/toggle_collapse
      # Toggle user's collapse preference for a navigation item
      def toggle_collapse
        config = current_user.user_navigation_configs.find_or_create_by!(
          navigation_item_id: params[:id]
        ) do |c|
          # Set default from NavigationItem if creating new
          c.is_collapsed = NavigationItem.find(params[:id]).is_collapsed_default
        end

        config.update!(is_collapsed: !config.is_collapsed)
        render json: { success: true, is_collapsed: config.is_collapsed }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Navigation item not found" }, status: :not_found
      end

      # POST /api/v1/navigation/reset
      # Reset user's collapse preferences to system defaults
      def reset
        UserNavigationConfig.reset_for_user(current_user)
        render json: { success: true }
      end

      private

      def item_with_children_json(item, collapse_prefs)
        # Get visible children, ordered by position
        visible_children = item.children.active.ordered.select { |child| child.visible_to?(current_user) }

        # User's collapse preference, or default from NavigationItem
        is_collapsed = collapse_prefs.key?(item.id) ? collapse_prefs[item.id] : item.is_collapsed_default

        {
          id: item.id,
          name: item.name,
          href: item.href,
          icon: item.icon,
          badge_key: item.badge_key,
          position: item.position,
          is_collapsed: is_collapsed,
          has_children: visible_children.any?,
          children: visible_children.map { |child| child_item_json(child, collapse_prefs) }
        }
      end

      def child_item_json(child, collapse_prefs)
        {
          id: child.id,
          name: child.name,
          href: child.href,
          icon: child.icon,
          badge_key: child.badge_key,
          position: child.position
        }
      end
    end
  end
end
