# frozen_string_literal: true

module Api
  module V1
    module Admin
      # Controller for TEEEM staff to manage master tenant configuration
      #
      # TEEEM staff can:
      # - Browse any tenant's configuration
      # - Import selected records into master tenant
      # - View sync status across tenants
      #
      # SSoT: TenantConfigSyncService handles all sync logic
      class ConfigSyncController < ApplicationController
        before_action :require_teeem_staff!

        # GET /api/v1/admin/config_sync/tables
        # List available configuration tables
        def tables
          service = TenantConfigSyncService.new(master_tenant)

          render json: {
            success: true,
            tables: service.available_tables,
            master_tenant: tenant_info(master_tenant),
            available_tenants: available_tenants_list
          }
        end

        # GET /api/v1/admin/config_sync/tenants/:tenant_id/config/:table
        # Browse a tenant's configuration records
        #
        # Params:
        #   filter_existing_contacts: boolean - For price_histories, only show records
        #                                       where the supplier exists in master tenant
        def browse
          source_tenant = Tenant.find(params[:tenant_id])
          service = TenantConfigSyncService.new(master_tenant)
          records = service.browse_tenant_config(source_tenant, params[:table])
          total_unfiltered = records.length

          # Filter price_histories to only show records for contacts that exist in master tenant
          if params[:table] == "price_histories" && params[:filter_existing_contacts] == "true"
            # Get contact display_names that exist in master tenant
            master_contact_names = ActsAsTenant.with_tenant(master_tenant) do
              Contact.pluck(:display_name).compact.map(&:downcase)
            end

            # Get source tenant contact names mapped to IDs
            source_contacts = ActsAsTenant.with_tenant(source_tenant) do
              Contact.pluck(:id, :display_name).to_h
            end

            # Filter records where supplier exists in master
            records = records.select do |record|
              supplier_id = record[:supplier_id] || record["supplier_id"]
              supplier_name = source_contacts[supplier_id]&.downcase
              supplier_name && master_contact_names.include?(supplier_name)
            end
          end

          render json: {
            success: true,
            table: params[:table],
            source_tenant: tenant_info(source_tenant),
            records: records,
            total_unfiltered: total_unfiltered
          }
        rescue ActiveRecord::RecordNotFound
          render json: { success: false, error: "Tenant not found" }, status: :not_found
        rescue ArgumentError => e
          render json: { success: false, error: e.message }, status: :bad_request
        end

        # POST /api/v1/admin/config_sync/import
        # Import selected records from a tenant into master tenant
        #
        # Params:
        #   source_tenant_id: integer - tenant to import from
        #   table: string - config table name
        #   record_ids: array - IDs of records to import
        def import
          source_tenant = Tenant.find(import_params[:source_tenant_id])
          service = TenantConfigSyncService.new(master_tenant)

          result = service.import_from_tenant(
            source_tenant: source_tenant,
            table: import_params[:table],
            record_ids: import_params[:record_ids].map(&:to_i)
          )

          if result[:success]
            Rails.logger.info "[ConfigSync] User #{current_user.id} imported #{result[:imported].length} records from #{source_tenant.name}"

            render json: {
              success: true,
              message: "Configuration imported successfully",
              imported: result[:imported],
              skipped: result[:skipped]
            }
          else
            render json: {
              success: false,
              error: "Import failed with errors",
              errors: result[:errors],
              imported: result[:imported],
              skipped: result[:skipped]
            }, status: :unprocessable_entity
          end
        rescue ActiveRecord::RecordNotFound
          render json: { success: false, error: "Tenant not found" }, status: :not_found
        rescue ArgumentError => e
          render json: { success: false, error: e.message }, status: :bad_request
        end

        # GET /api/v1/admin/config_sync/sync_preferences
        # Get sync preferences for master tenant records
        #
        # Params:
        #   table: string - config table name
        def sync_preferences
          table_config = TenantConfigSyncService::CONFIG_TABLES[params[:table]&.to_sym]
          unless table_config
            return render json: { success: false, error: "Unknown table" }, status: :bad_request
          end

          model_name = table_config[:model]
          preferences = TenantSyncPreference.modes_for_type(model_name, tenant: master_tenant)

          render json: {
            success: true,
            table: params[:table],
            model: model_name,
            preferences: preferences # { record_id => sync_mode }
          }
        end

        # POST /api/v1/admin/config_sync/sync_preferences
        # Update sync preferences for master tenant records
        #
        # Params:
        #   table: string - config table name
        #   record_ids: array - IDs of records to update
        #   sync_mode: string - 'compulsory', 'choice', or null to remove
        def update_sync_preferences
          table_config = TenantConfigSyncService::CONFIG_TABLES[sync_pref_params[:table]&.to_sym]
          unless table_config
            return render json: { success: false, error: "Unknown table" }, status: :bad_request
          end

          model = table_config[:model].constantize
          record_ids = sync_pref_params[:record_ids].map(&:to_i)
          sync_mode = sync_pref_params[:sync_mode]

          # Validate sync_mode
          if sync_mode.present? && !TenantSyncPreference::SYNC_MODES.include?(sync_mode)
            return render json: {
              success: false,
              error: "Invalid sync_mode. Must be 'compulsory', 'choice', or null"
            }, status: :bad_request
          end

          # Get records from master tenant
          records = ActsAsTenant.with_tenant(master_tenant) do
            model.where(id: record_ids)
          end

          if records.empty?
            return render json: { success: false, error: "No records found" }, status: :not_found
          end

          # Update preferences
          updated = []
          records.each do |record|
            TenantSyncPreference.set_mode(record, sync_mode.presence, tenant: master_tenant)
            updated << record.id
          end

          Rails.logger.info "[ConfigSync] User #{current_user.id} set sync_mode=#{sync_mode || 'null'} for #{updated.length} #{table_config[:model]} records"

          render json: {
            success: true,
            message: "Sync preferences updated",
            updated_count: updated.length,
            sync_mode: sync_mode
          }
        rescue => e
          render json: { success: false, error: e.message }, status: :unprocessable_entity
        end

        # GET /api/v1/admin/config_sync/compare
        # Compare records across multiple tenants for a table
        #
        # Params:
        #   table: string - config table to compare
        #   tenant_ids: array - optional list of tenant IDs (defaults to all)
        def compare
          tenants = if params[:tenant_ids].present?
                      Tenant.where(id: params[:tenant_ids])
                    else
                      Tenant.where.not(slug: [nil, ""])
                    end

          service = TenantConfigSyncService.new(master_tenant)
          table_config = TenantConfigSyncService::CONFIG_TABLES[params[:table].to_sym]

          unless table_config
            return render json: { success: false, error: "Unknown table" }, status: :bad_request
          end

          # Build comparison matrix
          comparison = {}

          tenants.each do |tenant|
            records = service.browse_tenant_config(tenant, params[:table])
            records.each do |record|
              name = record[:name]
              comparison[name] ||= { name: name, tenants: {} }
              comparison[name][:tenants][tenant.slug || tenant.id.to_s] = {
                id: record[:id],
                exists: true,
                updated_at: record[:updated_at]
              }
            end
          end

          # Mark missing entries
          comparison.each_value do |entry|
            tenants.each do |tenant|
              key = tenant.slug || tenant.id.to_s
              entry[:tenants][key] ||= { exists: false }
            end
          end

          render json: {
            success: true,
            table: params[:table],
            tenants: tenants.map { |t| tenant_info(t) },
            records: comparison.values.sort_by { |r| r[:name].to_s.downcase }
          }
        rescue ArgumentError => e
          render json: { success: false, error: e.message }, status: :bad_request
        end

        private

        def require_teeem_staff!
          return if current_user&.teeem_staff?

          render json: {
            success: false,
            error: "Unauthorized. TEEEM staff access required."
          }, status: :forbidden
        end

        def master_tenant
          # Use Tenant model (new multi-tenancy) instead of CorporateGroup
          @master_tenant ||= Tenant.find_by(is_master_tenant: true) ||
                             Tenant.find_by(slug: "teeem")
        end

        def available_tenants_list
          # Use Tenant model (new multi-tenancy) instead of CorporateGroup
          Tenant.where.not(slug: [nil, ""])
                .order(:name)
                .map { |t| tenant_info(t) }
        end

        def tenant_info(tenant)
          return nil unless tenant
          {
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
            is_master_tenant: tenant.is_master_tenant?
          }
        end

        def import_params
          params.permit(:source_tenant_id, :table, record_ids: [])
        end

        def sync_pref_params
          params.permit(:table, :sync_mode, record_ids: [])
        end
      end
    end
  end
end
