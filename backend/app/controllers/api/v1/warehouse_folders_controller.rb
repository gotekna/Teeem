# SSoT: Unified Tab Configuration API
# This replaces multiple tab configuration endpoints with ONE unified API
module Api
  module V1
    class WarehouseFoldersController < ApplicationController
      before_action :set_warehouse_folder, only: [:show, :update, :destroy]

      # GET /api/v1/warehouse_folders?warehouse_type=corporate
      # Also accepts ?scope= for backwards compatibility
      # Use include_disabled=true for admin views to show all tabs
      #
      # Performance: Uses WarehouseFolderQueryService to eliminate N+1 queries
      # Original: 431 queries (657ms) → Optimized: ~5 queries (<50ms)
      def index
        # Accept both warehouse_type and scope params (scope for backwards compat)
        warehouse_type = params[:warehouse_type] || params[:scope]

        service = WarehouseFolderQueryService.new(
          warehouse_type: warehouse_type,
          entity_type: params[:entity_type],
          include_disabled: params[:include_disabled] == "true",
          tab_group: params[:tab_group],
          with_document_types: params[:with_document_types] == "true"
        )

        tabs = service.nested_tabs

        render json: {
          success: true,
          data: {
            warehouse_type: warehouse_type,
            scope: warehouse_type,  # Legacy backwards compat
            tabs: tabs,
            groups: WarehouseFolder::TAB_GROUPS,
            primary_xero_name: WarehouseFolder.primary_xero_name  # SSoT: Name of primary Xero account
          }
        }
      end

      # GET /api/v1/warehouse_folders/:id
      def show
        render json: {
          success: true,
          data: @warehouse_folder.as_nested_json
        }
      end

      # POST /api/v1/warehouse_folders
      def create
        @warehouse_folder = WarehouseFolder.new(warehouse_folder_params)

        if @warehouse_folder.save
          render json: { success: true, data: @warehouse_folder.as_nested_json }, status: :created
        else
          render json: { success: false, error: @warehouse_folder.errors.full_messages.join(', ') }, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /api/v1/warehouse_folders/:id
      def update
        Rails.logger.info "[WarehouseFolders#update] Received params: #{warehouse_folder_params.inspect}"
        Rails.logger.info "[WarehouseFolders#update] folder_path value: #{warehouse_folder_params[:folder_path].inspect}"

        if @warehouse_folder.update(warehouse_folder_params)
          @warehouse_folder.reload  # Ensure we get the actual saved value
          Rails.logger.info "[WarehouseFolders#update] Saved. DB value: #{@warehouse_folder.read_attribute(:folder_path).inspect}"

          render json: { success: true, data: @warehouse_folder.as_nested_json }
        else
          render json: { success: false, error: @warehouse_folder.errors.full_messages.join(', ') }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/warehouse_folders/:id
      def destroy
        # Check if can be deleted
        unless @warehouse_folder.can_delete?
          error_msg = if @warehouse_folder.is_system_tab
            "System tabs cannot be deleted. You can disable them instead."
          else
            "This tab contains #{@warehouse_folder.document_count} documents. Move or delete them first."
          end

          return render json: { success: false, error: error_msg }, status: :unprocessable_entity
        end

        @warehouse_folder.destroy
        render json: { success: true, message: "Tab '#{@warehouse_folder.display_name}' deleted" }
      end

      # POST /api/v1/warehouse_folders/reorder
      def reorder
        params[:tabs].each_with_index do |tab_data, index|
          WarehouseFolder.where(id: tab_data[:id]).update_all(
            order_position: index,
            parent_id: tab_data[:parent_id]
          )
        end

        render json: { success: true, message: "Tabs reordered successfully" }
      end

      # POST /api/v1/warehouse_folders/:id/toggle
      def toggle
        @warehouse_folder = WarehouseFolder.find(params[:id])
        @warehouse_folder.update!(enabled: !@warehouse_folder.enabled)

        render json: {
          success: true,
          data: @warehouse_folder.as_nested_json,
          message: "Tab #{@warehouse_folder.enabled ? 'enabled' : 'disabled'}"
        }
      end

      # GET /api/v1/warehouse_folders/for_warehouse_type/:warehouse_type
      # Also accepts for_scope/:scope for backwards compatibility (route alias)
      # Returns flat list of all tabs for a warehouse type (for dropdowns)
      def for_scope
        # Accept both warehouse_type and scope params (scope for backwards compat)
        warehouse_type = params[:warehouse_type] || params[:scope]

        tabs = WarehouseFolder.for_warehouse_type(warehouse_type)
                        .enabled
                        .ordered
                        .includes(:parent)

        render json: {
          success: true,
          data: {
            warehouse_type: warehouse_type,
            scope: warehouse_type,  # Legacy backwards compat
            tabs: tabs.map do |tab|
              {
                id: tab.id,
                tab_key: tab.tab_key,
                display_name: tab.display_name,
                display_code: tab.display_code,
                hierarchy_path: tab.hierarchy_path,
                tab_group: tab.tab_group,
                warehouse_enabled: tab.warehouse_enabled,
                has_storage_folder: tab.warehouse_enabled,  # Legacy backwards compat
                has_sharepoint_folder: tab.warehouse_enabled  # Legacy backwards compat
              }
            end
          }
        }
      end

      # GET /api/v1/warehouse_folders/entity_types
      # Returns configured entity types for the entity filter dropdown
      def entity_types
        render json: {
          success: true,
          data: TenantSetting.corporate_entity_types
        }
      end

      # PUT /api/v1/warehouse_folders/entity_types
      # Update the list of entity types
      def update_entity_types
        types = params[:entity_types]

        unless types.is_a?(Array) && types.all? { |t| t.is_a?(String) && t.present? }
          return render json: { success: false, error: "entity_types must be an array of strings" }, status: :unprocessable_entity
        end

        TenantSetting.update_corporate_entity_types(types)

        render json: {
          success: true,
          data: TenantSetting.corporate_entity_types,
          message: "Entity types updated"
        }
      end

      # GET /api/v1/warehouse_folders/document_type_counts
      # Returns count of document types linked per warehouse type + total document types
      def document_type_counts
        counts = WarehouseFolder::WAREHOUSE_TYPES.each_with_object({}) do |warehouse_type, hash|
          hash[warehouse_type] = WarehouseFolderDocumentType
            .joins(:warehouse_folder)
            .where(warehouse_folders: { warehouse_type: warehouse_type })
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

      # POST /api/v1/warehouse_folders/reset_paths
      # Reset all tabs to use inherited SSoT paths (clears folder_path, sets uses_custom_path = false)
      def reset_paths
        updated_count = WarehouseFolder
          .where(warehouse_enabled: true)
          .where("uses_custom_path = true OR folder_path IS NOT NULL")
          .update_all(uses_custom_path: false, folder_path: nil)

        render json: {
          success: true,
          updated_count: updated_count,
          message: "#{updated_count} tabs reset to use default SSoT paths"
        }
      end

      # GET /api/v1/warehouse_folders/used_icons?warehouse_type=job
      # Also accepts ?scope= for backwards compatibility
      # Returns list of icons already used by root tabs in a warehouse type
      # Used by IconPicker to gray out already-used icons
      def used_icons
        warehouse_type = params[:warehouse_type] || params[:scope]

        icons = WarehouseFolder.for_warehouse_type(warehouse_type)
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

      # GET /api/v1/warehouse_folders/global_icon_usage
      # Returns ALL icon usages across the system for consistency tracking
      # SSoT: Shows where each icon is used (warehouse folders, navigation) to ensure design consistency
      def global_icon_usage
        usages = {}

        # Collect icon usage from ALL warehouse folder warehouse types
        WarehouseFolder::WAREHOUSE_TYPES.each do |warehouse_type|
          WarehouseFolder.for_warehouse_type(warehouse_type)
                   .root_tabs
                   .global
                   .where.not(icon_name: [nil, ''])
                   .each do |tab|
            icon = tab.icon_name
            usages[icon] ||= []
            usages[icon] << {
              area: "Warehouse Folders",
              warehouse_type: warehouse_type.humanize,
              scope: warehouse_type.humanize,  # Legacy backwards compat
              name: tab.display_name,
              id: tab.id,
              type: "warehouse_folder"
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

      # GET /api/v1/warehouse_folders/tree
      # Returns full folder tree for File Warehouse page
      # SSoT: All folder structure comes from warehouse_folders table
      #
      # Response structure:
      # {
      #   success: true,
      #   data: {
      #     tree: [
      #       { id: "wf-123", name: "Documents", type: "category", icon: "folder", fileCount: 0, children: [...] },
      #       { id: "wf-124", name: "Plans", type: "category", icon: "folder", fileCount: 0, children: [...] },
      #       ...
      #     ],
      #     counts: { "jobs" => 1234, "corporate" => 567, ... },
      #     total: 80149
      #   }
      # }
      def tree
        # Get all root warehouse folders (parent_id: nil) with warehouse_enabled
        root_folders = WarehouseFolder
          .where(parent_id: nil, warehouse_enabled: true, enabled: true)
          .includes(:children)
          .order(:order_position, :display_name)

        # Build tree recursively
        tree = root_folders.map { |folder| build_tree_node(folder) }

        # Get document counts per warehouse_type from WarehouseDocument
        counts = fetch_warehouse_counts

        render json: {
          success: true,
          data: {
            tree: tree,
            counts: counts,
            total: counts.values.sum
          }
        }
      end

      private

      # Build a tree node from a WarehouseFolder
      def build_tree_node(folder, depth = 0)
        # Get enabled children
        children = folder.children
          .where(warehouse_enabled: true, enabled: true)
          .order(:order_position, :display_name)

        {
          id: "wf-#{folder.id}",
          name: folder.display_name,
          type: "category",
          icon: folder.icon_name || "folder",
          warehouseType: folder.warehouse_type,
          folderPath: folder.folder_path,
          fullPath: folder.effective_folder_path,
          fileCount: 0,  # Will be enriched by frontend from counts
          children: depth < 5 ? children.map { |child| build_tree_node(child, depth + 1) } : []
        }
      end

      # Fetch document counts grouped by warehouse_type
      def fetch_warehouse_counts
        # Count WarehouseDocuments by source_type (which maps to warehouse_type)
        counts = WarehouseDocument.group(:source_type).count

        # Map source_type to standard count keys
        {
          "jobs" => counts["job"] || 0,
          "corporate" => counts["corporate"] || 0,
          "contacts" => counts["contact"] || 0,
          "emails" => counts["email"] || 0,
          "tasks" => counts["task"] || 0,
          "users" => counts["user"] || 0,
          "warehousing" => counts["warehouse"] || 0,
          "templates" => counts["template"] || 0,
          "total" => counts.values.sum
        }
      end

      def set_warehouse_folder
        @warehouse_folder = WarehouseFolder.find(params[:id])
      end

      def warehouse_folder_params
        # Accept both old and new param names for backwards compatibility
        permitted = params.require(:warehouse_folder).permit(
          :warehouse_type,
          :scope,  # Legacy backwards compat
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
          # New warehouse naming
          :warehouse_enabled,
          :folder_path,  # Custom folder path template (replaces display_name in SSoT template)
          :warehouse_type_override,
          # Legacy backwards compat
          :has_storage_folder,
          :has_sharepoint_folder,
          # storage_folder_path/sharepoint_folder_path REMOVED - now derived from SSoT
          :storage_path_type,
          :sharepoint_path_type,
          :uses_custom_path,  # SSoT: Template inheritance flag
          :is_photo_category,  # SSoT: Explicit photo gallery flag
          :is_cad_category,  # SSoT: Explicit CAD/Revit file viewer flag
          :display_mode,  # SSoT: How tab renders (icon_only, text_only, both)
          :hidden_by_default,  # SSoT: Tab hidden in overflow menu by default
          :xero_scope,  # SSoT: Which Xero account this tab uses (nil, "primary", or tenant_id)
          :download_name,  # SSoT: "Document Download Name" in UI
          :ui_name,  # SSoT: "Document UI Name" in UI (Feb 2026)
          entity_filters: [],
          document_type_ids: []  # SSoT: Link document types to this tab
        )

        # Map old param names to new ones (only if present, to avoid overwriting existing values on PATCH)
        scope_value = permitted.delete(:scope)
        permitted[:warehouse_type] ||= scope_value if scope_value.present?

        storage_enabled = permitted.delete(:has_storage_folder) || permitted.delete(:has_sharepoint_folder)
        permitted[:warehouse_enabled] ||= storage_enabled unless storage_enabled.nil?

        path_type = permitted.delete(:storage_path_type) || permitted.delete(:sharepoint_path_type)
        permitted[:warehouse_type_override] ||= path_type if path_type.present?

        permitted
      end
    end
  end
end
