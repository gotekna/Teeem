module Api
  module V1
    class CorporateEntityTabsController < ApplicationController
      # GET /api/v1/corporate/entity_tabs
      # Returns all corporate entity tabs in correct order
      # SSoT: This is THE source of truth for company/trust/superfund tab configuration
      def index
        tabs = if params[:entity_type].present?
          CorporateEntityTab.tabs_for_entity(params[:entity_type])
        else
          CorporateEntityTab.all_tabs_ordered
        end

        render json: {
          success: true,
          data: tabs
        }
      end

      # GET /api/v1/corporate/entity_tabs/:id
      def show
        tab = CorporateEntityTab.find_by!(tab_key: params[:id])

        render json: {
          success: true,
          data: serialize_tab(tab)
        }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Tab not found" }, status: :not_found
      end

      # POST /api/v1/corporate/entity_tabs
      def create
        tab = CorporateEntityTab.new(tab_params)

        if tab.save
          render json: {
            success: true,
            data: serialize_tab(tab)
          }, status: :created
        else
          render json: {
            success: false,
            errors: tab.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/corporate/entity_tabs/:id
      def update
        tab = CorporateEntityTab.find_by!(tab_key: params[:id])

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

      # DELETE /api/v1/corporate/entity_tabs/:id
      def destroy
        tab = CorporateEntityTab.find_by!(tab_key: params[:id])
        tab.destroy

        render json: { success: true }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Tab not found" }, status: :not_found
      end

      # POST /api/v1/corporate/entity_tabs/reorder
      def reorder
        params[:tabs].each_with_index do |tab_data, index|
          tab = CorporateEntityTab.find_by(tab_key: tab_data[:id])
          tab&.update(order_position: index + 1)
        end

        render json: {
          success: true,
          data: CorporateEntityTab.all_tabs_ordered
        }
      end

      # POST /api/v1/corporate/entity_tabs/seed
      # Seeds the default tabs (used for initial setup)
      def seed
        CorporateEntityTab.seed_defaults!

        render json: {
          success: true,
          data: CorporateEntityTab.all_tabs_ordered,
          message: "Seeded #{CorporateEntityTab.count} tabs"
        }
      end

      private

      def tab_params
        params.require(:tab).permit(
          :tab_key,
          :display_name,
          :tab_group,
          :enabled,
          :order_position,
          :icon_name,
          :description,
          :component_name,
          entity_types: []
        )
      end

      def serialize_tab(tab)
        {
          id: tab.tab_key,
          name: tab.display_name,
          type: tab.tab_group,
          group: tab.tab_group,
          icon: tab.icon_name,
          entity_types: tab.entity_types,
          enabled: tab.enabled,
          order_position: tab.order_position,
          description: tab.description,
          component: tab.component_name
        }
      end
    end
  end
end
