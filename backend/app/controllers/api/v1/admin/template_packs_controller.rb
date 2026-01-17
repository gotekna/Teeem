# frozen_string_literal: true

module Api
  module V1
    module Admin
      class TemplatePacksController < ApplicationController
        before_action :require_admin!
        before_action :set_template_pack, only: [:show, :import, :destroy]

        # GET /api/v1/admin/template_packs
        # List available template packs for the current tenant
        def index
          packs = TemplatePack.available_for(current_tenant)
                              .includes(:source_tenant, :template_pack_items)
                              .order(visibility: :desc, created_at: :desc)

          render json: {
            success: true,
            template_packs: packs.map { |p| pack_json(p) }
          }
        end

        # GET /api/v1/admin/template_packs/:id
        # Get template pack details including items
        def show
          render json: {
            success: true,
            template_pack: pack_json(@pack, include_items: true)
          }
        end

        # POST /api/v1/admin/template_packs
        # Export current tenant's configuration as a new template pack
        def export
          service = TemplateExportService.new(current_tenant, created_by: current_user)

          pack = if params[:item_types].present?
                   service.export_selective(
                     name: export_params[:name],
                     description: export_params[:description],
                     item_types: export_params[:item_types].map(&:to_sym),
                     visibility: export_params[:visibility]&.to_sym || :private_pack
                   )
                 else
                   service.export_full_pack(
                     name: export_params[:name],
                     description: export_params[:description],
                     visibility: export_params[:visibility]&.to_sym || :private_pack
                   )
                 end

          render json: {
            success: true,
            message: "Template pack created successfully",
            template_pack: pack_json(pack, include_items: true)
          }
        rescue ArgumentError => e
          render json: { success: false, error: e.message }, status: :unprocessable_entity
        end

        # POST /api/v1/admin/template_packs/:id/import
        # Import a template pack into the current tenant
        def import
          service = TemplateImportService.new(current_tenant, @pack)

          result = service.import!(
            skip_existing: params[:skip_existing] == true || params[:skip_existing] == "true",
            item_types: params[:item_types]&.map(&:to_sym)
          )

          if result[:success]
            render json: {
              success: true,
              message: "Template pack imported successfully",
              imported: result[:imported]
            }
          else
            render json: {
              success: false,
              error: "Import failed with errors",
              errors: result[:errors],
              imported: result[:imported]
            }, status: :unprocessable_entity
          end
        end

        # POST /api/v1/admin/template_packs/:id/validate
        # Validate import without actually importing (dry run)
        def validate
          @pack = TemplatePack.find(params[:id])
          service = TemplateImportService.new(current_tenant, @pack)

          result = service.validate!

          render json: {
            success: true,
            valid: result[:valid],
            would_import: result[:would_import],
            errors: result[:errors]
          }
        end

        # DELETE /api/v1/admin/template_packs/:id
        # Delete a template pack (only if owned by current tenant)
        def destroy
          unless @pack.source_tenant_id == current_tenant&.id || current_user.teeem_staff?
            return render json: { success: false, error: "Cannot delete packs from other tenants" }, status: :forbidden
          end

          @pack.destroy!

          render json: {
            success: true,
            message: "Template pack deleted"
          }
        end

        # POST /api/v1/admin/template_packs/sync
        # Sync configuration from one tenant to another (TEEEM staff only)
        def sync
          require_teeem_staff!

          source = CorporateGroup.find(sync_params[:source_tenant_id])
          target = CorporateGroup.find(sync_params[:target_tenant_id])

          service = TenantSyncService.new(source_tenant: source, target_tenant: target)

          result = if sync_params[:item_types].present?
                     service.sync!(item_types: sync_params[:item_types].map(&:to_sym))
                   elsif sync_params[:sync_type] == "schedule_masters"
                     service.sync_schedule_masters!
                   else
                     service.sync_all!
                   end

          if result[:success]
            render json: {
              success: true,
              message: "Sync completed successfully",
              pack_id: result[:pack_id],
              pack_name: result[:pack_name],
              imported: result[:imported]
            }
          else
            render json: {
              success: false,
              error: "Sync failed with errors",
              errors: result[:errors],
              imported: result[:imported]
            }, status: :unprocessable_entity
          end
        rescue ArgumentError => e
          render json: { success: false, error: e.message }, status: :unprocessable_entity
        end

        # GET /api/v1/admin/template_packs/sync_preview
        # Preview what would be synced (TEEEM staff only)
        def sync_preview
          require_teeem_staff!

          source = CorporateGroup.find(params[:source_tenant_id])
          target = CorporateGroup.find(params[:target_tenant_id])

          service = TenantSyncService.new(source_tenant: source, target_tenant: target)
          preview = service.preview_sync

          render json: {
            success: true,
            source_tenant: { id: source.id, name: source.name },
            target_tenant: { id: target.id, name: target.name },
            would_import: preview[:would_import],
            valid: preview[:valid],
            errors: preview[:errors]
          }
        rescue ArgumentError => e
          render json: { success: false, error: e.message }, status: :unprocessable_entity
        end

        private

        def set_template_pack
          @pack = TemplatePack.find(params[:id])

          # Verify access
          unless TemplatePack.available_for(current_tenant).exists?(id: @pack.id) || current_user.teeem_staff?
            render json: { success: false, error: "Template pack not found" }, status: :not_found
          end
        end

        def require_admin!
          return if current_user&.admin? || current_user&.teeem_staff?

          render json: { success: false, error: "Admin access required" }, status: :forbidden
        end

        def require_teeem_staff!
          return if current_user&.teeem_staff?

          render json: { success: false, error: "TEEEM staff access required" }, status: :forbidden
        end

        def current_tenant
          ActsAsTenant.current_tenant
        end

        def export_params
          params.permit(:name, :description, :visibility, item_types: [])
        end

        def sync_params
          params.permit(:source_tenant_id, :target_tenant_id, :sync_type, item_types: [])
        end

        def pack_json(pack, include_items: false)
          json = {
            id: pack.id,
            name: pack.name,
            description: pack.description,
            status: pack.status,
            visibility: pack.visibility,
            version: pack.version,
            downloads_count: pack.downloads_count,
            source_tenant: {
              id: pack.source_tenant.id,
              name: pack.source_tenant.name,
              slug: pack.source_tenant.slug
            },
            created_by: pack.created_by ? {
              id: pack.created_by.id,
              name: pack.created_by.name
            } : nil,
            created_at: pack.created_at,
            updated_at: pack.updated_at,
            items_count: pack.template_pack_items.count,
            item_types: pack.template_pack_items.pluck(:item_type).uniq
          }

          if include_items
            json[:items] = pack.template_pack_items.order(:position).map do |item|
              {
                id: item.id,
                item_type: item.item_type,
                position: item.position,
                records_count: item.data.is_a?(Array) ? item.data.length : 1
              }
            end
          end

          json
        end
      end
    end
  end
end
