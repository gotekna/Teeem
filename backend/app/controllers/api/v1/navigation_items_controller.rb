module Api
  module V1
    class NavigationItemsController < ApplicationController
      before_action :require_admin
      before_action :set_item, only: [ :update, :destroy, :move_to_group, :set_parent ]

      # GET /api/v1/navigation_items
      def index
        items = NavigationItem.ordered.includes(:navigation_group)
        render json: {
          success: true,
          navigation_items: items.map { |i| full_item_json(i) }
        }
      end

      # POST /api/v1/navigation_items
      def create
        group_id = item_params[:navigation_group_id]
        position = item_params[:position] ||
                   (NavigationItem.where(navigation_group_id: group_id).maximum(:position) || -1) + 1

        @item = NavigationItem.new(item_params.merge(position: position))

        if @item.save
          render json: { success: true, navigation_item: full_item_json(@item) }, status: :created
        else
          render json: { success: false, errors: @item.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/navigation_items/:id
      def update
        if @item.update(item_params)
          render json: { success: true, navigation_item: full_item_json(@item) }
        else
          render json: { success: false, errors: @item.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/navigation_items/:id
      def destroy
        @item.destroy
        render json: { success: true }
      end

      # POST /api/v1/navigation_items/reorder
      def reorder
        params[:item_ids].each_with_index do |id, index|
          NavigationItem.where(id: id).update_all(position: index)
        end

        render json: { success: true }
      end

      # PATCH /api/v1/navigation_items/:id/move_to_group
      def move_to_group
        group_id = params[:navigation_group_id] # nil for ungrouped

        # Get new position at end of target group
        new_position = (NavigationItem.where(navigation_group_id: group_id).maximum(:position) || -1) + 1

        if @item.update(navigation_group_id: group_id, position: new_position)
          render json: { success: true, navigation_item: full_item_json(@item) }
        else
          render json: { success: false, errors: @item.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/navigation_items/:id/set_parent
      def set_parent
        parent_id = params[:parent_id] # nil for top-level

        if @item.update(parent_id: parent_id)
          render json: { success: true, navigation_item: full_item_json(@item) }
        else
          render json: { success: false, errors: @item.errors.full_messages }, status: :unprocessable_entity
        end
      end

      private

      def require_admin
        head :forbidden unless current_user&.admin?
      end

      def set_item
        @item = NavigationItem.find(params[:id])
      end

      def item_params
        params.require(:navigation_item).permit(
          :name, :href, :icon, :badge_key, :navigation_group_id, :parent_id, :is_active, :position, :is_collapsed_default, visible_to_roles: []
        )
      end

      def full_item_json(item)
        {
          id: item.id,
          name: item.name,
          href: item.href,
          icon: item.icon,
          badge_key: item.badge_key,
          position: item.position,
          parent_id: item.parent_id,
          navigation_group_id: item.navigation_group_id,
          is_active: item.is_active,
          is_collapsed_default: item.is_collapsed_default,
          visible_to_roles: item.visible_to_roles,
          has_children: item.children.exists?,
          children_count: item.children.count,
          created_at: item.created_at,
          updated_at: item.updated_at
        }
      end
    end
  end
end
