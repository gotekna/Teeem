# frozen_string_literal: true

# SSoT: Unified Tab Configuration API
# This controller queries WarehouseFolder (THE ONE table)
# API endpoints remain the same for backwards compatibility
module Api
  module V1
    class WarehouseFoldersController < ApplicationController
      include WarehouseFolderPathLookup

      before_action :set_warehouse_folder, only: [:show, :update, :destroy]

      # GET /api/v1/warehouse_folders?warehouse_type=corporate
      # Also accepts ?scope= for backwards compatibility
      # Use include_disabled=true for admin views to show all tabs
      #
      # Performance: Uses WarehouseFolderQueryService to eliminate N+1 queries
      def index
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
            groups: WarehouseFolder::TAB_GROUPS
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
          render_validation_errors(@warehouse_folder)
        end
      end

      # PATCH/PUT /api/v1/warehouse_folders/:id
      # Path cascades handled by WarehouseFolder model callback:
      #   after_commit :queue_template_recompute (triggers RecomputeWarehouseTypePathsJob)
      def update
        Rails.logger.info "[WarehouseFolders#update] Received params: #{warehouse_folder_params.inspect}"

        if @warehouse_folder.update(warehouse_folder_params)
          @warehouse_folder.reload
          render json: { success: true, data: @warehouse_folder.as_nested_json }
        else
          render_validation_errors(@warehouse_folder)
        end
      end

      # DELETE /api/v1/warehouse_folders/:id
      def destroy
        unless @warehouse_folder.can_delete?
          return render_error(@warehouse_folder.deletion_blocked_reason, status: :unprocessable_entity)
        end

        @warehouse_folder.destroy
        render json: { success: true, message: "Folder '#{@warehouse_folder.display_name || @warehouse_folder.name}' deleted" }
      end

      # POST /api/v1/warehouse_folders/reorder
      def reorder
        params[:tabs].each_with_index do |tab_data, index|
          WarehouseFolder.where(id: tab_data[:id]).update_all(
            order_position: index,
            parent_id: tab_data[:parent_id]
          )
        end

        render json: { success: true, message: "Folders reordered successfully" }
      end

      # POST /api/v1/warehouse_folders/:id/toggle
      def toggle
        @warehouse_folder = WarehouseFolder.find(params[:id])
        @warehouse_folder.update!(enabled: !@warehouse_folder.enabled)

        render json: {
          success: true,
          data: @warehouse_folder.as_nested_json,
          message: "Folder #{@warehouse_folder.enabled ? 'enabled' : 'disabled'}"
        }
      end

      # GET /api/v1/warehouse_folders/for_warehouse_type/:warehouse_type
      # Also accepts for_scope/:scope for backwards compatibility (route alias)
      # Returns flat list of all tabs for a warehouse type (for dropdowns)
      def for_scope
        warehouse_type = params[:warehouse_type] || params[:scope]

        tabs = WarehouseFolder.for_warehouse_type(warehouse_type)
                         .enabled
                         .ordered
                         .includes(:parent, :warehouse_type)

        render json: {
          success: true,
          data: {
            warehouse_type: warehouse_type,
            scope: warehouse_type,  # Legacy backwards compat
            tabs: tabs.map do |tab|
              {
                id: tab.id,
                tab_key: tab.tab_key,
                display_name: tab.display_name || tab.name,
                display_code: tab.display_code,
                hierarchy_path: lookup_full_folder_path(tab),
                tab_group: tab.tab_group,
                warehouse_enabled: tab.warehouse_enabled,
                has_storage_folder: tab.warehouse_enabled
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
          return render_error("entity_types must be an array of strings", status: :unprocessable_entity)
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
      # FRC (Feb 2026): Was N+1 (one query per warehouse type). Now single query.
      def document_type_counts
        # Single query: group by warehouse_type code, count distinct document_type_ids
        raw_counts = WarehouseFolderDocumentType
          .joins(warehouse_folder: :warehouse_type)
          .where(warehouse_types: { enabled: true })
          .group("warehouse_types.code")
          .distinct
          .count(:document_type_id)

        counts = raw_counts.merge('document_types' => DocumentType.count)

        render json: {
          success: true,
          data: { counts: counts }
        }
      end

      # POST /api/v1/warehouse_folders/reset_paths
      # Reset all tabs to use inherited SSoT paths (clears folder_path_suffix, sets uses_custom_path = false)
      def reset_paths
        updated_count = WarehouseFolder
          .where(warehouse_enabled: true)
          .where("uses_custom_path = true OR folder_path_suffix IS NOT NULL")
          .update_all(uses_custom_path: false, folder_path_suffix: nil)

        render json: {
          success: true,
          updated_count: updated_count,
          message: "#{updated_count} folders reset to use default SSoT paths"
        }
      end

      # GET /api/v1/warehouse_folders/used_icons?warehouse_type=job
      # Also accepts ?scope= for backwards compatibility
      # Returns list of icons already used by root tabs in a warehouse type
      def used_icons
        warehouse_type = params[:warehouse_type] || params[:scope]

        icons = WarehouseFolder.for_warehouse_type(warehouse_type)
                          .root_folders
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
      def global_icon_usage
        usages = {}

        WarehouseType.enabled.each do |wt|
          WarehouseFolder.for_warehouse_type(wt.code)
                    .root_folders
                    .where.not(icon_name: [nil, ''])
                    .each do |folder|
            icon = folder.icon_name
            usages[icon] ||= []
            usages[icon] << {
              area: "Warehouse Folders",
              warehouse_type: wt.display_name,
              scope: wt.display_name,  # Legacy backwards compat
              name: folder.display_name || folder.name,
              id: folder.id,
              type: "warehouse_folder"
            }
          end
        end

        if defined?(NavigationItem)
          NavigationItem.where.not(icon: [nil, '']).includes(:navigation_group).each do |item|
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
      # FRC (Feb 2026): Pre-load ALL folders in one query and build tree in Ruby.
      # Old code used folder.children.where(...) recursively → N+1 queries (Sentry TEEEM-BACKEND-4M).
      def tree
        counts = fetch_warehouse_counts

        # Single query: load ALL warehouse-enabled folders with their warehouse_type
        all_folders = WarehouseFolder
          .where(warehouse_enabled: true, enabled: true)
          .where.not(folder_segment: [nil, ''])
          .includes(:warehouse_type)
          .order(:order_position, :name)
          .to_a

        # Build lookup: parent_id → children (in-memory, zero DB queries for tree building)
        @tree_children_by_parent = all_folders.group_by(&:parent_id)
        root_folders = @tree_children_by_parent[nil] || []

        # Group roots by warehouse_type
        grouped = root_folders.group_by(&:warehouse_type)

        tree = grouped.map do |wt, folders|
          next nil if wt.blank?

          {
            id: "wf-#{wt.code}",
            name: wt.display_name,
            type: "category",
            icon: wt.icon_name || "folder",
            warehouseType: wt.code,
            folderPath: wt.display_name,
            fullPath: wt.display_name,
            fileCount: counts[wt.code] || 0,
            children: folders.map { |folder| build_tree_node(folder) }
          }
        end.compact

        # Sort by warehouse_type order_position (DB-driven, not hardcoded)
        wt_order = WarehouseType.enabled.ordered.pluck(:code)
        tree.sort_by! { |node| wt_order.index(node[:warehouseType]) || 999 }

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

      def build_tree_node(folder, depth = 0)
        # Use pre-loaded children from @tree_children_by_parent (zero DB queries)
        children = (@tree_children_by_parent[folder.id] || [])
          .sort_by(&:order_position)

        {
          id: "wf-#{folder.id}",
          name: folder.display_name || folder.name,
          type: "category",
          icon: folder.icon_name || "folder",
          warehouseType: folder.warehouse_type_code,
          folderPath: lookup_full_folder_path(folder),
          fullPath: lookup_full_folder_path(folder),
          fileCount: 0,
          children: depth < 5 ? children.map { |child| build_tree_node(child, depth + 1) } : []
        }
      end

      def fetch_warehouse_counts
        # Group by warehouse_type code (set via FK chain, not source_type)
        counts = WarehouseDocument.where.not(warehouse_type: [nil, ""]).group(:warehouse_type).count
        counts["total"] = counts.values.sum
        counts
      end

      def set_warehouse_folder
        @warehouse_folder = WarehouseFolder.find(params[:id])
      end

      def warehouse_folder_params
        permitted = params.require(:warehouse_folder).permit(
          :warehouse_type_id,
          :warehouse_type,
          :scope,  # Legacy backwards compat
          :tab_key,
          :tab_type,
          :name,
          :display_name,
          :display_code,
          :description,
          :tab_group,
          :parent_id,
          :folder_segment,
          :folder_path_suffix,
          :order_position,
          :enabled,
          :icon_name,
          :component_name,
          :warehouse_enabled,
          :warehouse_type_override,
          :uses_custom_path,
          :is_photo_category,
          :is_cad_category,
          :display_mode,
          :hidden_by_default,
          :xero_scope,
          :visibility_rule,
          :ui_name_template,
          :download_name_template,
          :is_system,
          :is_mailbox,
          entity_filters: [],
          document_type_ids: []
        )

        # Map old param names to new ones (only if present)
        scope_value = permitted.delete(:scope)
        if scope_value.present? && permitted[:warehouse_type].blank?
          wt = WarehouseType.find_by_code(scope_value)
          permitted[:warehouse_type_id] = wt.id if wt
        end

        warehouse_type_value = permitted.delete(:warehouse_type)
        if warehouse_type_value.present? && permitted[:warehouse_type_id].blank?
          wt = WarehouseType.find_by_code(warehouse_type_value)
          permitted[:warehouse_type_id] = wt.id if wt
        end

        # Map folder_path to folder_path_suffix for legacy compatibility
        # FRC (Feb 2026): folder_path from frontend = the suffix value only (not full path)
        # .key? check ensures we can clear the suffix by sending empty string → nil
        if params[:warehouse_folder].key?(:folder_path)
          permitted[:folder_path_suffix] = params[:warehouse_folder][:folder_path].presence
        end

        # Map ui_name to ui_name_template
        if params[:warehouse_folder][:ui_name].present? && permitted[:ui_name_template].blank?
          permitted[:ui_name_template] = params[:warehouse_folder][:ui_name]
        end

        # Map download_name to download_name_template
        if params[:warehouse_folder][:download_name].present? && permitted[:download_name_template].blank?
          permitted[:download_name_template] = params[:warehouse_folder][:download_name]
        end

        permitted
      end
    end
  end
end
