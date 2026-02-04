# frozen_string_literal: true

module Api
  module V1
    # WarehouseTypesController - CRUD for warehouse types
    #
    # SSoT: Database-driven warehouse types (Feb 2026)
    # Replaces the hardcoded WAREHOUSE_TYPES constant with database table
    #
    class WarehouseTypesController < ApplicationController
      before_action :set_warehouse_type, only: [:show, :update, :destroy, :update_base_folders]

      # GET /api/v1/warehouse_types
      def index
        @warehouse_types = WarehouseType.includes(:base_folders).visible

        # Filter by enabled status
        @warehouse_types = @warehouse_types.enabled unless params[:include_disabled] == "true"

        # Filter by system/custom
        @warehouse_types = @warehouse_types.system_types if params[:system_only] == "true"
        @warehouse_types = @warehouse_types.custom_types if params[:custom_only] == "true"

        render json: {
          success: true,
          data: @warehouse_types.ordered.map { |wt| serialize_warehouse_type(wt) },
          summary: warehouse_type_summary
        }
      end

      # GET /api/v1/warehouse_types/options
      # Returns warehouse types formatted for select dropdowns
      def options
        render json: {
          success: true,
          data: WarehouseType.options_for_select
        }
      end

      # GET /api/v1/warehouse_types/:id
      def show
        render json: {
          success: true,
          data: serialize_warehouse_type(@warehouse_type)
        }
      end

      # POST /api/v1/warehouse_types
      def create
        @warehouse_type = WarehouseType.new(warehouse_type_params)

        if @warehouse_type.save
          render json: {
            success: true,
            data: serialize_warehouse_type(@warehouse_type)
          }, status: :created
        else
          render json: {
            success: false,
            errors: @warehouse_type.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /api/v1/warehouse_types/:id
      def update
        old_template = @warehouse_type.folder_path_template

        if @warehouse_type.update(warehouse_type_params)
          # SSoT (Feb 2026): Cascade folder_path_template changes to base_folders and warehouse_folders
          new_template = @warehouse_type.folder_path_template
          if old_template != new_template
            cascade_template_change(old_template, new_template)
          end

          render json: {
            success: true,
            data: serialize_warehouse_type(@warehouse_type)
          }
        else
          render json: {
            success: false,
            errors: @warehouse_type.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/warehouse_types/:id
      def destroy
        if @warehouse_type.is_system
          return render json: {
            success: false,
            error: "System warehouse types cannot be deleted"
          }, status: :forbidden
        end

        unless @warehouse_type.can_delete?
          return render json: {
            success: false,
            error: "Cannot delete warehouse type with associated base folders or document types"
          }, status: :unprocessable_entity
        end

        @warehouse_type.destroy
        render json: { success: true }
      end

      # PATCH /api/v1/warehouse_types/:id/update_base_folders
      # Batch update base folder assignments for a warehouse type
      #
      # Folders removed from this type are moved to the "unassigned" type
      # (warehouse_type_id has NOT NULL constraint, so folders must belong somewhere)
      def update_base_folders
        base_folder_ids = params[:base_folder_ids] || []

        # Move removed folders to unassigned type (instead of deleting)
        removed_folders = @warehouse_type.base_folders.where.not(id: base_folder_ids)
        if removed_folders.exists?
          unassigned_type = WarehouseType.unassigned
          removed_folders.update_all(warehouse_type_id: unassigned_type.id)
        end

        # Assign selected folders to this type (may steal from other types)
        if base_folder_ids.present?
          BaseFolder.where(id: base_folder_ids).update_all(warehouse_type_id: @warehouse_type.id)
        end

        # Reload and return updated warehouse type
        @warehouse_type.reload
        render json: {
          success: true,
          data: serialize_warehouse_type(@warehouse_type)
        }
      end

      private

      def set_warehouse_type
        @warehouse_type = WarehouseType.find(params[:id])
      end

      def warehouse_type_params
        params.require(:warehouse_type).permit(
          :code,
          :display_name,
          :description,
          :icon_name,
          :folder_path_template,
          :enabled,
          :order_position
        )
      end

      # Build full path by walking up parent hierarchy
      # e.g., Statement → Balance Sheet → Xero = "Xero/Balance Sheet/Statement"
      # ALWAYS use name (not folder_path_template) to avoid duplicating the warehouse type prefix
      def build_ancestor_path(base_folder)
        path_parts = []
        current = base_folder

        while current.present?
          # Always use name - folder_path_template may contain full paths that would duplicate
          path_parts.unshift(current.name)
          current = current.parent
        end

        path_parts.join('/')
      end

      def serialize_warehouse_type(warehouse_type)
        {
          id: warehouse_type.id,
          code: warehouse_type.code,
          display_name: warehouse_type.display_name,
          description: warehouse_type.description,
          icon_name: warehouse_type.icon_name,
          folder_path_template: warehouse_type.folder_path_template,
          is_system: warehouse_type.is_system,
          enabled: warehouse_type.enabled,
          order_position: warehouse_type.order_position,
          base_folders_count: warehouse_type.base_folders.count,
          base_folders: warehouse_type.base_folders.enabled.ordered.map do |bf|
            # SSoT (Feb 2026): Return full_path_template for tree building
            # FRC: Build full path by combining:
            # 1. Warehouse type's base template (e.g., "Corporate/{{CompanyGroup}}/{{CompanyCode}}")
            # 2. Ancestor path from parent hierarchy (e.g., "Xero/Balance Sheet/Statement")
            #
            # Example: Corporate type has "Corporate/{{CompanyGroup}}/{{CompanyCode}}"
            #          Statement has parent Balance Sheet, which has parent Xero
            #          Full path = "Corporate/{{CompanyGroup}}/{{CompanyCode}}/Xero/Balance Sheet/Statement"
            wt_template = warehouse_type.folder_path_template.presence

            # Build path from parent hierarchy
            ancestor_path = build_ancestor_path(bf)

            full_template = if wt_template.blank?
              # No warehouse type template → just use ancestor path
              ancestor_path
            else
              # Check if ancestor path already starts with the scope root
              scope_root = wt_template.split('/').first
              if ancestor_path.start_with?(scope_root)
                # Already a full path → use as-is
                ancestor_path
              else
                # Combine warehouse type template + ancestor path
                "#{wt_template}/#{ancestor_path}"
              end
            end

            # SSoT (Feb 2026): Include linked warehouse_folder for UI/DL editing
            wf = WarehouseFolder.includes(:document_types).find_by(base_folder_id: bf.id)

            {
              id: bf.id,
              name: bf.name,
              parent_id: bf.parent_id,
              parent_name: bf.parent&.name,
              children_count: bf.children.count,
              folder_path_template: bf.folder_path_template,
              full_path_template: full_template,
              path_preview: bf.path_preview,
              is_system: bf.is_system,
              warehouse_folder: wf ? {
                id: wf.id,
                display_name: wf.display_name,
                folder_path: wf.folder_path,
                ui_name: wf.ui_name,
                download_name: wf.download_name,
                # SSoT (Feb 2026): Include document_types for tree view display
                # ui_name/download_name show orange if missing, green if configured
                document_types: wf.document_types.map { |dt|
                  {
                    id: dt.id,
                    name: dt.name,
                    abbreviation: dt.abbreviation,
                    ui_name: dt.ui_name,
                    download_name: dt.download_name
                  }
                }
              } : nil
            }
          end,
          can_delete: warehouse_type.can_delete?,
          created_at: warehouse_type.created_at,
          updated_at: warehouse_type.updated_at
        }
      end

      def warehouse_type_summary
        {
          total: WarehouseType.count,
          enabled: WarehouseType.enabled.count,
          system: WarehouseType.system_types.count,
          custom: WarehouseType.custom_types.count
        }
      end

      # SSoT (Feb 2026): Cascade folder_path_template changes to related records
      # When a warehouse_type's template changes, update:
      # 1. base_folders that have templates starting with the old prefix
      # 2. warehouse_folders that reference those base_folders
      def cascade_template_change(old_template, new_template)
        return if old_template.blank? && new_template.blank?

        # Normalize: remove trailing slashes for comparison
        old_prefix = old_template&.chomp('/') || ''
        new_prefix = new_template&.chomp('/') || ''

        # Update base_folders that have folder_path_template starting with old prefix
        @warehouse_type.base_folders.each do |bf|
          next if bf.folder_path_template.blank?

          if bf.folder_path_template.start_with?(old_prefix)
            # Replace old prefix with new prefix
            new_bf_template = bf.folder_path_template.sub(old_prefix, new_prefix)
            bf.update_column(:folder_path_template, new_bf_template)

            # Also update linked warehouse_folders
            WarehouseFolder.where(base_folder_id: bf.id).find_each do |wf|
              next if wf.folder_path.blank?

              if wf.folder_path.start_with?(old_prefix)
                new_wf_path = wf.folder_path.sub(old_prefix, new_prefix)
                wf.update_column(:folder_path, new_wf_path)
              end
            end
          end
        end

        # Also update any warehouse_folders directly linked to this warehouse_type
        # (not through base_folder) that have paths starting with old prefix
        WarehouseFolder.where(warehouse_type: @warehouse_type.code).find_each do |wf|
          next if wf.folder_path.blank?

          if wf.folder_path.start_with?(old_prefix)
            new_wf_path = wf.folder_path.sub(old_prefix, new_prefix)
            wf.update_column(:folder_path, new_wf_path)
          end
        end
      end
    end
  end
end
