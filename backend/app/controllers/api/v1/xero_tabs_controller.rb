module Api
  module V1
    class XeroTabsController < ApplicationController
      # GET /api/v1/xero/tabs
      # Returns all Xero tabs (functional + document folders) in correct order
      # SSoT: This is THE source of truth for Xero tab configuration
      def index
        tabs = XeroFeatureTab.all_tabs_ordered

        render json: {
          success: true,
          data: tabs
        }
      end

      # GET /api/v1/xero/tabs/:id
      def show
        tab = XeroFeatureTab.find_by!(tab_key: params[:id])

        render json: {
          success: true,
          data: serialize_tab(tab)
        }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Tab not found" }, status: :not_found
      end

      # PATCH /api/v1/xero/tabs/:id
      def update
        tab = XeroFeatureTab.find_by!(tab_key: params[:id])

        if tab.update(tab_params)
          render json: {
            success: true,
            data: serialize_tab(tab)
          }
        else
          render json: {
            success: false,
            errors: tab.errors.full_messages
          }, status: :unprocessable_entity
        end
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Tab not found" }, status: :not_found
      end

      # POST /api/v1/xero/tabs/reorder
      def reorder
        params[:tabs].each_with_index do |tab_data, index|
          tab = XeroFeatureTab.find_by(tab_key: tab_data[:id])
          tab&.update(order_position: index + 1)
        end

        render json: {
          success: true,
          data: XeroFeatureTab.all_tabs_ordered
        }
      end

      private

      def tab_params
        params.require(:tab).permit(:display_name, :enabled, :order_position, :icon_name, :description, :parent_key, :group_member, :visible)
      end

      def serialize_tab(tab)
        {
          id: tab.tab_key,
          name: tab.display_name,
          type: tab.component_name.present? ? "functional" : "document",
          component: tab.component_name,
          icon: tab.icon_name,
          group: tab.tab_group,
          enabled: tab.enabled,
          order_position: tab.order_position,
          description: tab.description,
          parent: tab.parent_key,
          group_member: tab.group_member,
          visible: tab.visible
        }
      end
    end
  end
end
