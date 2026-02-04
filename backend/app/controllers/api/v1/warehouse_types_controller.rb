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
        if @warehouse_type.update(warehouse_type_params)
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
            # FRC: Combine warehouse type's template + base folder's template for full path
            #
            # Logic:
            # 1. If base folder has no template → use warehouse type's template
            # 2. If base folder has a full path (starts with scope root like "Jobs/") → use as-is
            # 3. If base folder has a relative path (like "Attachments") → prepend warehouse type's template
            #
            # Example: Task warehouse type has "Tasks/{{TaskId}}/{{TaskName}}"
            #          Task Attachments base folder has "Attachments"
            #          Full path = "Tasks/{{TaskId}}/{{TaskName}}/Attachments"
            wt_template = warehouse_type.folder_path_template.presence
            bf_template = bf.folder_path_template.presence

            full_template = if bf_template.blank?
              # No base folder template → use warehouse type's template
              wt_template || bf.name
            elsif wt_template.blank?
              # No warehouse type template → use base folder template as-is
              bf_template
            else
              # Both have templates - check if base folder is relative or absolute
              # Extract the root folder from warehouse type template (e.g., "Tasks" from "Tasks/{{TaskId}}/{{TaskName}}")
              scope_root = wt_template.split('/').first
              if bf_template.start_with?(scope_root)
                # Base folder has full path (starts with scope root like "Jobs/") → use as-is
                bf_template
              else
                # Base folder has relative path → prepend warehouse type's template
                "#{wt_template}/#{bf_template}"
              end
            end

            {
              id: bf.id,
              name: bf.name,
              folder_path_template: bf.folder_path_template,
              full_path_template: full_template,
              path_preview: bf.path_preview,
              ui_name_template: bf.ui_name_template,
              download_name_template: bf.download_name_template,
              is_system: bf.is_system
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
    end
  end
end
