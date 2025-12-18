module Api
  module V1
    class NavigationController < ApplicationController
      # GET /api/v1/navigation
      # Returns full nav structure for current user (filtered by role)
      def index
        user_role = current_user&.role || "user"

        groups = NavigationGroup
          .active
          .ordered
          .visible_to_role(user_role)
          .includes(:navigation_items)

        ungrouped_items = NavigationItem
          .active
          .ungrouped
          .ordered
          .visible_to_role(user_role)

        render json: {
          success: true,
          navigation: {
            groups: groups.map { |g| group_json(g, user_role) },
            ungrouped_items: ungrouped_items.map { |i| item_json(i) }
          }
        }
      end

      private

      def group_json(group, user_role)
        {
          id: group.id,
          name: group.name,
          icon: group.icon,
          position: group.position,
          is_collapsible: group.is_collapsible,
          items: group.navigation_items
            .active
            .ordered
            .visible_to_role(user_role)
            .map { |i| item_json(i) }
        }
      end

      def item_json(item)
        {
          id: item.id,
          name: item.name,
          href: item.href,
          icon: item.icon,
          badge_key: item.badge_key,
          position: item.position,
          navigation_group_id: item.navigation_group_id
        }
      end
    end
  end
end
