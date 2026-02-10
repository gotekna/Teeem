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
      #   price_markup_percent: number - Optional markup % for pricebook items (e.g., 5 for 5%)
      def pull
        service = TenantConfigSyncService.new(current_tenant)

        result = service.pull_from_master(
          table: pull_params[:table],
          record_ids: pull_params[:record_ids].map(&:to_i),
          mode: (pull_params[:mode] || "add_new").to_sym,
          price_markup_percent: pull_params[:price_markup_percent].to_f
        )

        if result[:success]
          response_data = {
            success: true,
            message: "Configuration synced successfully",
            imported: result[:imported],
            updated: result[:updated],
            skipped: result[:skipped]
          }
          response_data[:price_markup_applied] = result[:price_markup_applied] if result[:price_markup_applied]
          render json: response_data
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
      # View master tenant's records for a specific table with sync preferences
      def master_records
        unless master_tenant
          return render json: { success: false, error: "No master tenant found" }, status: :not_found
        end

        table_config = TenantConfigSyncService::CONFIG_TABLES[params[:table]&.to_sym]
        unless table_config
          return render json: { success: false, error: "Unknown table" }, status: :bad_request
        end

        model = table_config[:model].constantize
        match_fields = table_config[:match_fields]

        # Get master records
        master_records = ActsAsTenant.with_tenant(master_tenant) do
          model.all.order(table_config[:name_field])
        end

        # Get sync preferences for master records
        preferences = TenantSyncPreference.modes_for_type(table_config[:model], tenant: master_tenant)

        # Get tenant's existing records for comparison
        tenant_records_by_key = ActsAsTenant.with_tenant(current_tenant) do
          model.all.index_by { |r| match_key(r, match_fields) }
        end

        # Build response with sync status
        records = master_records.map do |record|
          key = match_key(record, match_fields)
          tenant_record = tenant_records_by_key[key]

          record_json = {
            id: record.id,
            name: record.send(table_config[:name_field]),
            sync_mode: preferences[record.id],
            exists_in_tenant: tenant_record.present?,
            tenant_record_id: tenant_record&.id,
            created_at: record.created_at,
            updated_at: record.updated_at
          }

          # Include all sync fields for display
          table_config[:sync_fields].each do |field|
            record_json[field] = record.send(field) if record.respond_to?(field)
          end

          record_json
        end

        # Filter to only show records with sync_mode set (compulsory or choice)
        # unless show_all param is passed
        unless params[:show_all] == "true"
          records = records.select { |r| r[:sync_mode].present? }
        end

        render json: {
          success: true,
          table: params[:table],
          master_tenant: tenant_info(master_tenant),
          records: records,
          total_in_master: master_records.length
        }
      rescue ArgumentError => e
        render json: { success: false, error: e.message }, status: :bad_request
      end

      # POST /api/v1/config_sync/auto_sync_compulsory
      # Auto-sync all compulsory records from master to current tenant
      def auto_sync_compulsory
        service = TenantConfigSyncService.new(current_tenant)
        results = {}

        TenantConfigSyncService::CONFIG_TABLES.each_key do |table|
          table_config = TenantConfigSyncService::CONFIG_TABLES[table]
          compulsory_ids = TenantSyncPreference.compulsory_ids_for_type(table_config[:model], tenant: master_tenant)

          next if compulsory_ids.empty?

          result = service.pull_from_master(
            table: table.to_s,
            record_ids: compulsory_ids,
            mode: :replace_existing
          )

          results[table.to_s] = {
            imported: result[:imported]&.length || 0,
            updated: result[:updated]&.length || 0,
            skipped: result[:skipped]&.length || 0
          }
        end

        render json: {
          success: true,
          message: "Auto-sync completed",
          results: results
        }
      end

      # POST /api/v1/config_sync/pull_all
      # Fresh pull of ALL records from ALL tables from master tenant
      def pull_all
        service = TenantConfigSyncService.new(current_tenant)
        results = {}
        total_imported = 0
        total_updated = 0
        total_skipped = 0
        errors = []

        TenantConfigSyncService::CONFIG_TABLES.each_key do |table|
          table_config = TenantConfigSyncService::CONFIG_TABLES[table]

          # Get ALL master record IDs for this table
          all_ids = ActsAsTenant.with_tenant(master_tenant) do
            table_config[:model].constantize.pluck(:id)
          end

          next if all_ids.empty?

          begin
            result = service.pull_from_master(
              table: table.to_s,
              record_ids: all_ids,
              mode: :replace_existing
            )

            imported_count = result[:imported]&.length || 0
            updated_count = result[:updated]&.length || 0
            skipped_count = result[:skipped]&.length || 0

            results[table.to_s] = {
              imported: imported_count,
              updated: updated_count,
              skipped: skipped_count,
              total: all_ids.length
            }

            total_imported += imported_count
            total_updated += updated_count
            total_skipped += skipped_count
          rescue => e
            errors << "#{table}: #{e.message}"
            results[table.to_s] = { error: e.message }
          end
        end

        render json: {
          success: errors.empty?,
          message: "Pull all completed: #{total_imported} added, #{total_updated} updated, #{total_skipped} skipped",
          results: results,
          totals: {
            imported: total_imported,
            updated: total_updated,
            skipped: total_skipped,
            tables_processed: results.keys.length
          },
          errors: errors.presence
        }
      end

      # Helper to generate match key
      def match_key(record, match_fields)
        match_fields.map { |f| record.send(f).to_s.downcase.strip }.join("|")
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
        params.permit(:table, :mode, :price_markup_percent, record_ids: [])
      end

      def push_params
        params.permit(:table, record_ids: [])
      end
    end
  end
end
