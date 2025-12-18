module Api
  module V1
    class NavigationGroupsController < ApplicationController
      before_action :require_admin
      before_action :set_group, only: [ :update, :destroy ]

      # GET /api/v1/navigation_groups
      def index
        groups = NavigationGroup.ordered.includes(:navigation_items)
        render json: {
          success: true,
          navigation_groups: groups.map { |g| full_group_json(g) }
        }
      end

      # POST /api/v1/navigation_groups
      def create
        position = group_params[:position] || (NavigationGroup.maximum(:position) || -1) + 1
        @group = NavigationGroup.new(group_params.merge(position: position))

        if @group.save
          render json: { success: true, navigation_group: full_group_json(@group) }, status: :created
        else
          render json: { success: false, errors: @group.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/navigation_groups/:id
      def update
        if @group.update(group_params)
          render json: { success: true, navigation_group: full_group_json(@group) }
        else
          render json: { success: false, errors: @group.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/navigation_groups/:id
      def destroy
        # Move items to ungrouped before destroying
        @group.navigation_items.update_all(navigation_group_id: nil)
        @group.destroy
        render json: { success: true }
      end

      # POST /api/v1/navigation_groups/reorder
      def reorder
        params[:group_ids].each_with_index do |id, index|
          NavigationGroup.where(id: id).update_all(position: index)
        end

        groups = NavigationGroup.ordered.includes(:navigation_items)
        render json: {
          success: true,
          navigation_groups: groups.map { |g| full_group_json(g) }
        }
      end

      private

      def require_admin
        head :forbidden unless current_user&.admin?
      end

      def set_group
        @group = NavigationGroup.find(params[:id])
      end

      def group_params
        params.require(:navigation_group).permit(:name, :icon, :is_active, :is_collapsible, :position, visible_to_roles: [])
      end

      def full_group_json(group)
        {
          id: group.id,
          name: group.name,
          icon: group.icon,
          position: group.position,
          is_active: group.is_active,
          is_collapsible: group.is_collapsible,
          visible_to_roles: group.visible_to_roles,
          items_count: group.navigation_items.count,
          items: group.navigation_items.ordered.map { |i| item_json(i) }
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
          is_active: item.is_active,
          visible_to_roles: item.visible_to_roles
        }
      end
    end
  end
end
