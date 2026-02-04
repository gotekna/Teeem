# frozen_string_literal: true

module Api
  module V1
    # BaseFoldersController - CRUD for base folders
    #
    # SSoT: Database-driven base folders (Feb 2026)
    # Each WarehouseType has one or more BaseFolders with path templates
    #
    class BaseFoldersController < ApplicationController
      before_action :set_base_folder, only: [:show, :update, :destroy]

      # GET /api/v1/base_folders
      # GET /api/v1/warehouse_types/:warehouse_type_id/base_folders
      def index
        @base_folders = BaseFolder.includes(:warehouse_type)

        # Filter by warehouse type (either via nested route or param)
        if params[:warehouse_type_id].present?
          @base_folders = @base_folders.where(warehouse_type_id: params[:warehouse_type_id])
        elsif params[:warehouse_type_code].present?
          @base_folders = @base_folders.for_warehouse_type(params[:warehouse_type_code])
        end

        # Filter by enabled status
        @base_folders = @base_folders.enabled unless params[:include_disabled] == "true"

        render json: {
          success: true,
          data: @base_folders.ordered.map { |bf| serialize_base_folder(bf) }
        }
      end

      # GET /api/v1/base_folders/grouped
      # Returns base folders grouped by warehouse type for UI
      def grouped
        render json: {
          success: true,
          data: BaseFolder.grouped_options_for_select
        }
      end

      # GET /api/v1/base_folders/:id
      def show
        render json: {
          success: true,
          data: serialize_base_folder(@base_folder)
        }
      end

      # POST /api/v1/base_folders
      def create
        @base_folder = BaseFolder.new(base_folder_params)

        if @base_folder.save
          render json: {
            success: true,
            data: serialize_base_folder(@base_folder)
          }, status: :created
        else
          render json: {
            success: false,
            errors: @base_folder.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /api/v1/base_folders/:id
      def update
        if @base_folder.update(base_folder_params)
          render json: {
            success: true,
            data: serialize_base_folder(@base_folder)
          }
        else
          render json: {
            success: false,
            errors: @base_folder.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/base_folders/:id
      def destroy
        if @base_folder.is_system
          return render json: {
            success: false,
            error: "System base folders cannot be deleted"
          }, status: :forbidden
        end

        unless @base_folder.can_delete?
          return render json: {
            success: false,
            error: "Cannot delete base folder with associated warehouse folders"
          }, status: :unprocessable_entity
        end

        @base_folder.destroy
        render json: { success: true }
      end

      private

      def set_base_folder
        @base_folder = BaseFolder.find(params[:id])
      end

      def base_folder_params
        params.require(:base_folder).permit(
          :warehouse_type_id,
          :parent_id,
          :name,
          :folder_path_template,
          :enabled,
          :order_position
        )
      end

      def serialize_base_folder(base_folder)
        # SSoT (Feb 2026): Compute full_path_template by combining warehouse type template + base folder template
        wt_template = base_folder.warehouse_type&.folder_path_template.presence
        bf_template = base_folder.folder_path_template.presence

        full_template = if bf_template.blank?
          wt_template || base_folder.name
        elsif wt_template.blank?
          bf_template
        else
          # Check if base folder template is relative or absolute
          scope_root = wt_template.split('/').first
          if bf_template.start_with?(scope_root)
            bf_template
          else
            # Normalize: remove trailing slashes from wt_template, leading slashes from bf_template
            normalized_wt = wt_template.chomp('/')
            normalized_bf = bf_template.sub(/^\/+/, '')
            "#{normalized_wt}/#{normalized_bf}"
          end
        end

        {
          id: base_folder.id,
          warehouse_type_id: base_folder.warehouse_type_id,
          warehouse_type_code: base_folder.warehouse_type_code,
          warehouse_type_name: base_folder.warehouse_type&.display_name,
          parent_id: base_folder.parent_id,
          parent_name: base_folder.parent&.name,
          children_count: base_folder.children.count,
          name: base_folder.name,
          folder_path_template: base_folder.folder_path_template,
          full_path_template: full_template,
          path_preview: base_folder.path_preview,
          is_system: base_folder.is_system,
          enabled: base_folder.enabled,
          order_position: base_folder.order_position,
          warehouse_folders_count: base_folder.warehouse_folders.count,
          can_delete: base_folder.can_delete?,
          is_dynamic: base_folder.dynamic?,
          dynamic_type: base_folder.dynamic_type,
          created_at: base_folder.created_at,
          updated_at: base_folder.updated_at
        }
      end
    end
  end
end
