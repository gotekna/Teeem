# SSoT: Unified Tab Configuration API
# This replaces multiple tab configuration endpoints with ONE unified API
module Api
  module V1
    class EntityTabsController < ApplicationController
      before_action :set_entity_tab, only: [:show, :update, :destroy]

      # GET /api/v1/entity_tabs?scope=corporate_entity
      # Use include_disabled=true for admin views to show all tabs
      #
      # Performance: Uses EntityTabQueryService to eliminate N+1 queries
      # Original: 431 queries (657ms) → Optimized: ~5 queries (<50ms)
      def index
        service = EntityTabQueryService.new(
          scope: params[:scope],
          entity_type: params[:entity_type],
          include_disabled: params[:include_disabled] == "true",
          tab_group: params[:tab_group]
        )

        render json: {
          success: true,
          data: {
            scope: params[:scope],
            tabs: service.nested_tabs,
            groups: EntityTab::TAB_GROUPS,
            primary_xero_name: EntityTab.primary_xero_name  # SSoT: Name of primary Xero account
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
                display_code: tab.display_code,
                hierarchy_path: tab.hierarchy_path,
                tab_group: tab.tab_group,
                has_storage_folder: tab.has_storage_folder,
                has_sharepoint_folder: tab.has_storage_folder  # Backwards compat
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

      # POST /api/v1/entity_tabs/reset_paths
      # Reset all tabs to use inherited SSoT paths (sets uses_custom_path = false and clears custom path)
      def reset_paths
        updated_count = EntityTab
          .where(has_storage_folder: true)
          .where("uses_custom_path = true OR storage_folder_path IS NOT NULL AND storage_folder_path != ''")
          .update_all(uses_custom_path: false, storage_folder_path: nil)

        render json: {
          success: true,
          updated_count: updated_count,
          message: "#{updated_count} tabs reset to use default SSoT paths"
        }
      end

      # GET /api/v1/entity_tabs/used_icons?scope=job
      # Returns list of icons already used by root tabs in a scope
      # Used by IconPicker to gray out already-used icons
      def used_icons
        icons = EntityTab.for_scope(params[:scope])
                         .root_tabs
                         .global
                         .where.not(icon_name: [nil, ''])
                         .pluck(:id, :icon_name, :display_name)
                         .map { |id, icon, name| { id: id, icon_name: icon, display_name: name } }

        render json: {
          success: true,
          data: icons
        }
      end

      # GET /api/v1/entity_tabs/global_icon_usage
      # Returns ALL icon usages across the system for consistency tracking
      # SSoT: Shows where each icon is used (entity tabs, navigation) to ensure design consistency
      def global_icon_usage
        usages = {}

        # Collect icon usage from ALL entity tab scopes
        EntityTab::SCOPES.each do |scope|
          EntityTab.for_scope(scope)
                   .root_tabs
                   .global
                   .where.not(icon_name: [nil, ''])
                   .each do |tab|
            icon = tab.icon_name
            usages[icon] ||= []
            usages[icon] << {
              area: "Entity Tabs",
              scope: scope.humanize,
              name: tab.display_name,
              id: tab.id,
              type: "entity_tab"
            }
          end
        end

        # Collect icon usage from navigation items
        if defined?(NavigationItem)
          NavigationItem.where.not(icon: [nil, '']).each do |item|
            icon = item.icon
            usages[icon] ||= []
            usages[icon] << {
              area: "Navigation",
              scope: item.navigation_group&.name || "Main",
              name: item.name,
              id: item.id,
              type: "navigation_item"
            }
          end
        end

        render json: {
          success: true,
          data: usages
        }
      end

      private

      def set_entity_tab
        @entity_tab = EntityTab.find(params[:id])
      end

      def entity_tab_params
        # Accept both old and new param names for backwards compatibility
        permitted = params.require(:entity_tab).permit(
          :scope,
          :tab_key,
          :display_name,
          :display_code,
          :description,
          :tab_group,
          :parent_id,
          :job_id,
          :order_position,
          :enabled,
          :icon_name,
          :component_name,
          :has_storage_folder,
          :has_sharepoint_folder,  # Backwards compat
          :storage_folder_path,
          :sharepoint_folder_path,  # Backwards compat
          :uses_custom_path,  # SSoT: Template inheritance flag
          :storage_path_type,
          :sharepoint_path_type,  # Backwards compat
          :is_photo_category,  # SSoT: Explicit photo gallery flag
          :is_cad_category,  # SSoT: Explicit CAD/Revit file viewer flag
          :display_mode,  # SSoT: How tab renders (icon_only, text_only, both)
          :hidden_by_default,  # SSoT: Tab hidden in overflow menu by default
          :xero_scope,  # SSoT: Which Xero account this tab uses (nil, "primary", or tenant_id)
          entity_filters: [],
          document_type_ids: []  # SSoT: Link document types to this tab
        )

        # Map old param names to new ones
        permitted[:has_storage_folder] ||= permitted.delete(:has_sharepoint_folder)
        permitted[:storage_folder_path] ||= permitted.delete(:sharepoint_folder_path)
        permitted[:storage_path_type] ||= permitted.delete(:sharepoint_path_type)

        permitted
      end
    end
  end
end
