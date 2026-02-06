# frozen_string_literal: true

# SSoT: Unified Tab Configuration API
# This controller now queries BaseFolder (THE ONE table) instead of WarehouseFolder
# API endpoints remain the same for backwards compatibility
module Api
  module V1
    class WarehouseFoldersController < ApplicationController
      before_action :set_base_folder, only: [:show, :update, :destroy]

      # GET /api/v1/warehouse_folders?warehouse_type=corporate
      # Also accepts ?scope= for backwards compatibility
      # Use include_disabled=true for admin views to show all tabs
      #
      # Performance: Uses BaseFolderQueryService to eliminate N+1 queries
      def index
        warehouse_type = params[:warehouse_type] || params[:scope]

        service = BaseFolderQueryService.new(
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
            groups: BaseFolder::TAB_GROUPS
          }
        }
      end

      # GET /api/v1/warehouse_folders/:id
      def show
        render json: {
          success: true,
          data: @base_folder.as_nested_json
        }
      end

      # POST /api/v1/warehouse_folders
      def create
        @base_folder = BaseFolder.new(base_folder_params)

        if @base_folder.save
          render json: { success: true, data: @base_folder.as_nested_json }, status: :created
        else
          render json: { success: false, error: @base_folder.errors.full_messages.join(', ') }, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /api/v1/warehouse_folders/:id
      def update
        Rails.logger.info "[WarehouseFolders#update] Received params: #{base_folder_params.inspect}"

        if @base_folder.update(base_folder_params)
          @base_folder.reload
          render json: { success: true, data: @base_folder.as_nested_json }
        else
          render json: { success: false, error: @base_folder.errors.full_messages.join(', ') }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/warehouse_folders/:id
      def destroy
        unless @base_folder.can_delete?
          return render json: { success: false, error: @base_folder.deletion_blocked_reason }, status: :unprocessable_entity
        end

        @base_folder.destroy
        render json: { success: true, message: "Folder '#{@base_folder.display_name || @base_folder.name}' deleted" }
      end

      # POST /api/v1/warehouse_folders/reorder
      def reorder
        params[:tabs].each_with_index do |tab_data, index|
          BaseFolder.where(id: tab_data[:id]).update_all(
            order_position: index,
            parent_id: tab_data[:parent_id]
          )
        end

        render json: { success: true, message: "Folders reordered successfully" }
      end

      # POST /api/v1/warehouse_folders/:id/toggle
      def toggle
        @base_folder = BaseFolder.find(params[:id])
        @base_folder.update!(enabled: !@base_folder.enabled)

        render json: {
          success: true,
          data: @base_folder.as_nested_json,
          message: "Folder #{@base_folder.enabled ? 'enabled' : 'disabled'}"
        }
      end

      # GET /api/v1/warehouse_folders/for_warehouse_type/:warehouse_type
      # Also accepts for_scope/:scope for backwards compatibility (route alias)
      # Returns flat list of all tabs for a warehouse type (for dropdowns)
      def for_scope
        warehouse_type = params[:warehouse_type] || params[:scope]

        tabs = BaseFolder.for_warehouse_type(warehouse_type)
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
                hierarchy_path: tab.full_folder_path,
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
        counts = WarehouseType.enabled.each_with_object({}) do |wt, hash|
          hash[wt.code] = BaseFolderDocumentType
            .joins(:base_folder)
            .where(base_folders: { warehouse_type_id: wt.id })
            .distinct
            .count(:document_type_id)
        end

        counts['document_types'] = DocumentType.count

        render json: {
          success: true,
          data: { counts: counts }
        }
      end

      # POST /api/v1/warehouse_folders/reset_paths
      # Reset all tabs to use inherited SSoT paths (clears folder_path_suffix, sets uses_custom_path = false)
      def reset_paths
        updated_count = BaseFolder
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

        icons = BaseFolder.for_warehouse_type(warehouse_type)
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
          BaseFolder.for_warehouse_type(wt.code)
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
              type: "base_folder"
            }
          end
        end

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
      def tree
        counts = fetch_warehouse_counts

        all_folders = BaseFolder
          .where(parent_id: nil, warehouse_enabled: true, enabled: true)
          .where.not(folder_segment: [nil, ''])
          .includes(:children, :warehouse_type)
          .order(:order_position, :name)

        # Group folders by warehouse type's display name
        grouped = all_folders.group_by { |folder| folder.warehouse_type&.display_name }

        tree = grouped.map do |base_folder, folders|
          next nil if base_folder.blank?

          {
            id: "base-#{base_folder.downcase.gsub(/\s+/, '-')}",
            name: base_folder,
            type: "category",
            icon: base_folder_icon(base_folder),
            warehouseType: folders.first&.warehouse_type_code,
            folderPath: base_folder,
            fullPath: base_folder,
            fileCount: base_folder_count(base_folder, counts),
            children: folders.map { |folder| build_tree_node(folder) }
          }
        end.compact

        sort_order = %w[Jobs Corporate Contacts Contact Emails Tasks Users Warehousing Templates Cases Assets]
        tree.sort_by! { |node| sort_order.index(node[:name]) || 999 }

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

      def base_folder_icon(name)
        {
          "Jobs" => "briefcase",
          "Corporate" => "building2",
          "Contact" => "contact",
          "Contacts" => "contact",
          "Emails" => "mail",
          "Tasks" => "clipboard-list",
          "Users" => "user",
          "Warehousing" => "warehouse",
          "Templates" => "file-text",
          "Cases" => "folder",
          "Assets" => "package"
        }[name] || "folder"
      end

      def base_folder_count(name, counts)
        mapping = {
          "Jobs" => "jobs",
          "Corporate" => "corporate",
          "Contact" => "contacts",
          "Contacts" => "contacts",
          "Emails" => "emails",
          "Tasks" => "tasks",
          "Users" => "users",
          "Warehousing" => "warehousing",
          "Templates" => "templates"
        }
        counts[mapping[name]] || 0
      end

      def build_tree_node(folder, depth = 0)
        children = folder.children
          .where(warehouse_enabled: true, enabled: true)
          .order(:order_position, :name)

        {
          id: "bf-#{folder.id}",
          name: folder.display_name || folder.name,
          type: "category",
          icon: folder.icon_name || "folder",
          warehouseType: folder.warehouse_type_code,
          folderPath: folder.full_folder_path,
          fullPath: folder.full_folder_path,
          fileCount: 0,
          children: depth < 5 ? children.map { |child| build_tree_node(child, depth + 1) } : []
        }
      end

      def fetch_warehouse_counts
        counts = WarehouseDocument.group(:source_type).count

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

      def set_base_folder
        @base_folder = BaseFolder.find(params[:id])
      end

      def base_folder_params
        permitted = params.require(:warehouse_folder).permit(
          :warehouse_type_id,
          :warehouse_type,
          :scope,  # Legacy backwards compat
          :tab_key,
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
          :is_system_tab,
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
        if params[:warehouse_folder][:folder_path].present?
          permitted[:folder_path_suffix] = params[:warehouse_folder][:folder_path]
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
