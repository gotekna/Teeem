module Api
  module V1
    class NavigationController < ApplicationController
      # GET /api/v1/navigation
      # Returns user's personalized navigation (nested structure)
      def index
        # Initialize user's nav config if it doesn't exist
        UserNavigationConfig.initialize_for_user(current_user) unless current_user.user_navigation_configs.exists?

        user_role = current_user.role

        # Get user's navigation config with items
        configs = current_user.user_navigation_configs
          .visible
          .ordered
          .includes(navigation_item: :children)

        # Filter by role visibility and build nested structure
        visible_configs = configs.select do |config|
          item = config.navigation_item
          item.is_active && item.visible_to?(current_user)
        end

        # Separate top-level items and children
        top_level = visible_configs.select { |c| c.parent_id.nil? }
        children_by_parent = visible_configs.group_by(&:parent_id)

        render json: {
          success: true,
          navigation: {
            items: top_level.map { |config| item_with_children_json(config, children_by_parent) }
          }
        }
      end

      # PATCH /api/v1/navigation/reorder
      # Update user's navigation order
      def reorder
        params[:items].each_with_index do |item_data, index|
          config = current_user.user_navigation_configs.find_by(navigation_item_id: item_data[:id])
          next unless config

          config.update!(
            position: index,
            parent_id: item_data[:parent_id]
          )
        end

        render json: { success: true }
      end

      # PATCH /api/v1/navigation/:id/toggle_collapse
      def toggle_collapse
        config = current_user.user_navigation_configs.find_by(navigation_item_id: params[:id])
        if config
          config.update!(is_collapsed: !config.is_collapsed)
          render json: { success: true, is_collapsed: config.is_collapsed }
        else
          render json: { success: false, error: "Config not found" }, status: :not_found
        end
      end

      # PATCH /api/v1/navigation/:id/toggle_hidden
      def toggle_hidden
        config = current_user.user_navigation_configs.find_by(navigation_item_id: params[:id])
        if config
          config.update!(is_hidden: !config.is_hidden)
          render json: { success: true, is_hidden: config.is_hidden }
        else
          render json: { success: false, error: "Config not found" }, status: :not_found
        end
      end

      # POST /api/v1/navigation/reset
      # Reset user's navigation to system defaults
      def reset
        UserNavigationConfig.reset_for_user(current_user)
        render json: { success: true }
      end

      private

      def item_with_children_json(config, children_by_parent)
        item = config.navigation_item
        children = (children_by_parent[item.id] || []).sort_by(&:position)

        {
          id: item.id,
          name: item.name,
          href: item.href,
          icon: item.icon,
          badge_key: item.badge_key,
          position: config.position,
          is_collapsed: config.is_collapsed,
          has_children: children.any?,
          children: children.map { |child_config| child_item_json(child_config) }
        }
      end

      def child_item_json(config)
        item = config.navigation_item
        {
          id: item.id,
          name: item.name,
          href: item.href,
          icon: item.icon,
          badge_key: item.badge_key,
          position: config.position
        }
      end
    end
  end
end
