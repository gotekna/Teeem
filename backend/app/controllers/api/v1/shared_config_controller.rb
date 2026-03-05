# frozen_string_literal: true

module Api
  module V1
    # Dashboard endpoint for shared config tables (has_global_records: true)
    #
    # Shows all config tables with:
    # - Total record counts
    # - Global (shared) record counts (tenant_id IS NULL)
    # - Per-tenant record counts
    #
    # SSoT: TenantConfigSyncService::CONFIG_TABLES for table metadata
    # SSoT: GlobalConfigRecord concern for uses_global_records? check
    class SharedConfigController < ApplicationController
      before_action :require_admin!

      # GET /api/v1/shared_config/tables
      def tables
        tables_data = TenantConfigSyncService::CONFIG_TABLES.filter_map do |key, config|
          model_class = config[:model].constantize rescue nil
          next unless model_class
          next unless model_class.column_names.include?("tenant_id")

          uses_global = model_class.respond_to?(:uses_global_records?) && model_class.uses_global_records?

          # Count global records (tenant_id IS NULL) - unscoped to bypass acts_as_tenant
          global_count = ActsAsTenant.without_tenant do
            model_class.unscoped.where(tenant_id: nil).count
          end

          # Count total records across all tenants - unscoped
          total_count = ActsAsTenant.without_tenant do
            model_class.unscoped.count
          end

          # Per-tenant breakdown (only tenant-specific records, tenant_id IS NOT NULL)
          tenant_counts = ActsAsTenant.without_tenant do
            model_class.unscoped
              .where.not(tenant_id: nil)
              .joins("INNER JOIN tenants ON tenants.id = #{model_class.table_name}.tenant_id")
              .group("tenants.name")
              .count
          end

          {
            key: key.to_s,
            model: config[:model],
            table_name: model_class.table_name,
            description: config[:description],
            group: config[:group],
            uses_global_records: uses_global,
            counts: {
              total: total_count,
              global: global_count,
              tenant_specific: total_count - global_count,
              per_tenant: tenant_counts
            }
          }
        end

        # Group by category
        groups = TenantConfigSyncService::GROUP_LABELS.map do |group_key, group_label|
          group_tables = tables_data.select { |t| t[:group] == group_key }
          next if group_tables.empty?

          {
            key: group_key,
            label: group_label,
            tables: group_tables
          }
        end.compact

        render json: {
          success: true,
          data: {
            groups: groups,
            summary: {
              total_tables: tables_data.size,
              global_enabled: tables_data.count { |t| t[:uses_global_records] },
              total_records: tables_data.sum { |t| t[:counts][:total] },
              total_global: tables_data.sum { |t| t[:counts][:global] },
              total_tenant_specific: tables_data.sum { |t| t[:counts][:tenant_specific] }
            }
          }
        }
      end
    end
  end
end
