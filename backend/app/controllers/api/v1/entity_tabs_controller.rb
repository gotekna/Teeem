# SSoT: Unified Tab Configuration API
# This replaces multiple tab configuration endpoints with ONE unified API
module Api
  module V1
    class EntityTabsController < ApplicationController
      before_action :set_entity_tab, only: [:show, :update, :destroy]

      # GET /api/v1/entity_tabs?scope=corporate_entity
      # Use include_disabled=true for admin views to show all tabs
      def index
        tabs = EntityTab.for_scope(params[:scope])
                        .global
                        .root_tabs
                        .ordered
                        .includes(children: { children: :children }, document_types: [])

        # Filter to enabled only unless include_disabled is set (for admin)
        tabs = tabs.enabled unless params[:include_disabled] == "true"

        # Filter by entity type if provided
        if params[:entity_type].present?
          tabs = tabs.for_entity_type(params[:entity_type])
        end

        # Filter by tab group if provided
        if params[:tab_group].present?
          tabs = tabs.for_group(params[:tab_group])
        end

        render json: {
          success: true,
          data: {
            scope: params[:scope],
            tabs: tabs.map(&:as_nested_json),
            groups: EntityTab::TAB_GROUPS
          }
        }
      end

      # GET /api/v1/entity_tabs/:id
      def show
        render json: {
          success: true,
          data: @entity_tab.as_nested_json
        }
      end

      # POST /api/v1/entity_tabs
      def create
        @entity_tab = EntityTab.new(entity_tab_params)

        if @entity_tab.save
          render json: { success: true, data: @entity_tab.as_nested_json }, status: :created
        else
          render json: { success: false, error: @entity_tab.errors.full_messages.join(', ') }, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /api/v1/entity_tabs/:id
      def update
        if @entity_tab.update(entity_tab_params)
          render json: { success: true, data: @entity_tab.as_nested_json }
        else
          render json: { success: false, error: @entity_tab.errors.full_messages.join(', ') }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/entity_tabs/:id
      def destroy
        # Check if can be deleted
        unless @entity_tab.can_delete?
          error_msg = if @entity_tab.is_system_tab
            "System tabs cannot be deleted. You can disable them instead."
          else
            "This tab contains #{@entity_tab.document_count} documents. Move or delete them first."
          end

          return render json: { success: false, error: error_msg }, status: :unprocessable_entity
        end

        @entity_tab.destroy
        render json: { success: true, message: "Tab '#{@entity_tab.display_name}' deleted" }
      end

      # POST /api/v1/entity_tabs/reorder
      def reorder
        params[:tabs].each_with_index do |tab_data, index|
          EntityTab.where(id: tab_data[:id]).update_all(
            order_position: index,
            parent_id: tab_data[:parent_id]
          )
        end

        render json: { success: true, message: "Tabs reordered successfully" }
      end

      # POST /api/v1/entity_tabs/:id/toggle
      def toggle
        @entity_tab = EntityTab.find(params[:id])
        @entity_tab.update!(enabled: !@entity_tab.enabled)

        render json: {
          success: true,
          data: @entity_tab.as_nested_json,
          message: "Tab #{@entity_tab.enabled ? 'enabled' : 'disabled'}"
        }
      end

      # GET /api/v1/entity_tabs/for_scope/:scope
      # Returns flat list of all tabs for a scope (for dropdowns)
      def for_scope
        tabs = EntityTab.for_scope(params[:scope])
                        .enabled
                        .ordered
                        .includes(:parent)

        render json: {
          success: true,
          data: {
            scope: params[:scope],
            tabs: tabs.map do |tab|
              {
                id: tab.id,
                tab_key: tab.tab_key,
                display_name: tab.display_name,
                hierarchy_path: tab.hierarchy_path,
                tab_group: tab.tab_group,
                has_sharepoint_folder: tab.has_sharepoint_folder
              }
            end
          }
        }
      end

      # GET /api/v1/entity_tabs/entity_types
      # Returns configured entity types for the entity filter dropdown
      def entity_types
        render json: {
          success: true,
          data: CorporateCompanySetting.corporate_entity_types
        }
      end

      # PUT /api/v1/entity_tabs/entity_types
      # Update the list of entity types
      def update_entity_types
        types = params[:entity_types]

        unless types.is_a?(Array) && types.all? { |t| t.is_a?(String) && t.present? }
          return render json: { success: false, error: "entity_types must be an array of strings" }, status: :unprocessable_entity
        end

        CorporateCompanySetting.update_corporate_entity_types(types)

        render json: {
          success: true,
          data: CorporateCompanySetting.corporate_entity_types,
          message: "Entity types updated"
        }
      end

      # GET /api/v1/entity_tabs/document_type_counts
      # Returns count of document types linked per scope + total document types
      def document_type_counts
        counts = EntityTab::SCOPES.each_with_object({}) do |scope, hash|
          hash[scope] = EntityTabDocumentType
            .joins(:entity_tab)
            .where(entity_tabs: { scope: scope })
            .distinct
            .count(:document_type_id)
        end

        # Add total document types count
        counts['document_types'] = DocumentType.count

        render json: {
          success: true,
          data: { counts: counts }
        }
      end

      private

      def set_entity_tab
        @entity_tab = EntityTab.find(params[:id])
      end

      def entity_tab_params
        params.require(:entity_tab).permit(
          :scope,
          :tab_key,
          :display_name,
          :description,
          :tab_group,
          :parent_id,
          :job_id,
          :order_position,
          :enabled,
          :icon_name,
          :component_name,
          :has_sharepoint_folder,
          :sharepoint_folder_path,
          entity_filters: [],
          document_type_ids: []  # SSoT: Link document types to this tab
        )
      end
    end
  end
end
