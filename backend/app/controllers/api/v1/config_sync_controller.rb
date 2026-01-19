# frozen_string_literal: true

module Api
  module V1
    # Controller for tenant admins to sync configuration from TEEEM master tenant
    #
    # Allows tenant admins to:
    # - View available config tables
    # - Get diff between their config and TEEEM master
    # - Pull selected records from TEEEM
    #
    # SSoT: TenantConfigSyncService handles all sync logic
    class ConfigSyncController < ApplicationController
      before_action :require_admin!

      # GET /api/v1/config_sync/tables
      # List available configuration tables for sync (with counts)
      def tables
        service = TenantConfigSyncService.new(current_tenant)

        response = {
          success: true,
          tables: service.available_tables,
          counts: service.table_counts,
          groups: TenantConfigSyncService.groups,
          tenant: current_tenant ? tenant_info(current_tenant) : nil,
          master_tenant: master_tenant ? tenant_info(master_tenant) : nil,
          is_master_tenant: current_tenant&.is_master_tenant? || false
        }

        # Only TEEEM (master tenant) can see all tenant data
        # Other tenants only see their own + master for comparison
        if current_tenant&.is_master_tenant?
          all_counts = service.all_tenant_counts
          response[:all_tenant_counts] = all_counts[:counts]
          response[:all_tenants] = all_counts[:tenants]
        end

        render json: response
      end

      # GET /api/v1/config_sync/diff/:table
      # Get diff between tenant's config and master tenant
      def diff
        service = TenantConfigSyncService.new(current_tenant)
        result = service.diff_with_master(params[:table])

        if result[:error]
          render json: { success: false, error: result[:error] }, status: :unprocessable_entity
        else
          render json: { success: true, **result }
        end
      rescue ArgumentError => e
        render json: { success: false, error: e.message }, status: :bad_request
      end

      # POST /api/v1/config_sync/pull
      # Pull selected records from master tenant
      #
      # Params:
      #   table: string - config table name
      #   record_ids: array - IDs of records to pull from master
      #   mode: string - "add_new" | "replace_existing" | "skip_existing"
      def pull
        service = TenantConfigSyncService.new(current_tenant)

        result = service.pull_from_master(
          table: pull_params[:table],
          record_ids: pull_params[:record_ids].map(&:to_i),
          mode: (pull_params[:mode] || "add_new").to_sym
        )

        if result[:success]
          render json: {
            success: true,
            message: "Configuration synced successfully",
            imported: result[:imported],
            updated: result[:updated],
            skipped: result[:skipped]
          }
        else
          render json: {
            success: false,
            error: "Sync failed with errors",
            errors: result[:errors],
            imported: result[:imported],
            updated: result[:updated],
            skipped: result[:skipped]
          }, status: :unprocessable_entity
        end
      rescue ArgumentError => e
        render json: { success: false, error: e.message }, status: :bad_request
      end

      # GET /api/v1/config_sync/master_records/:table
      # View master tenant's records for a specific table
      def master_records
        unless master_tenant
          return render json: { success: false, error: "No master tenant found" }, status: :not_found
        end

        service = TenantConfigSyncService.new(current_tenant)
        records = service.browse_tenant_config(master_tenant, params[:table])

        render json: {
          success: true,
          table: params[:table],
          master_tenant: tenant_info(master_tenant),
          records: records
        }
      rescue ArgumentError => e
        render json: { success: false, error: e.message }, status: :bad_request
      end

      # POST /api/v1/config_sync/push
      # Push selected records from current tenant TO master tenant (TEEEM staff only)
      #
      # Params:
      #   table: string - config table name
      #   record_ids: array - IDs of records to push to master
      def push
        require_teeem_staff!

        unless master_tenant
          return render json: { success: false, error: "No master tenant found" }, status: :not_found
        end

        service = TenantConfigSyncService.new(master_tenant)

        result = service.import_from_tenant(
          source_tenant: current_tenant,
          table: push_params[:table],
          record_ids: push_params[:record_ids].map(&:to_i)
        )

        if result[:success]
          Rails.logger.info "[ConfigSync] User #{current_user.id} pushed #{result[:imported].length} records from #{current_tenant.name} to master"

          render json: {
            success: true,
            message: "Configuration pushed to master successfully",
            imported: result[:imported],
            skipped: result[:skipped]
          }
        else
          render json: {
            success: false,
            error: "Push failed with errors",
            errors: result[:errors],
            imported: result[:imported],
            skipped: result[:skipped]
          }, status: :unprocessable_entity
        end
      rescue ArgumentError => e
        render json: { success: false, error: e.message }, status: :bad_request
      end

      private

      def require_teeem_staff!
        return if current_user&.teeem_staff?

        render json: { success: false, error: "TEEEM staff access required" }, status: :forbidden
      end

      def require_admin!
        return if current_user&.admin?

        render json: { success: false, error: "Admin access required" }, status: :forbidden
      end

      def current_tenant
        ActsAsTenant.current_tenant
      end

      def master_tenant
        # Use Tenant model (new multi-tenancy) instead of CorporateGroup
        @master_tenant ||= Tenant.find_by(is_master_tenant: true) ||
                           Tenant.find_by(slug: "teeem")
      end

      def tenant_info(tenant)
        {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          is_master_tenant: tenant.is_master_tenant?
        }
      end

      def pull_params
        params.permit(:table, :mode, record_ids: [])
      end

      def push_params
        params.permit(:table, record_ids: [])
      end
    end
  end
end
