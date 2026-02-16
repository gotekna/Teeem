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

        tenant_setting = current_tenant&.tenant_setting

        response = {
          success: true,
          tables: service.available_tables,
          counts: service.table_counts,
          groups: TenantConfigSyncService.groups,
          tenant: current_tenant ? tenant_info(current_tenant) : nil,
          master_tenant: master_tenant ? tenant_info(master_tenant) : nil,
          is_master_tenant: current_tenant&.is_master_tenant? || false,
          last_config_sync_at: tenant_setting&.last_config_sync_at&.iso8601,
          last_config_sync_by: tenant_setting&.last_config_sync_by,
          config_sync_table_timestamps: tenant_setting&.config_sync_table_timestamps || {}
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
          render_error(result[:error], status: :unprocessable_entity)
        else
          render json: { success: true, **result }
        end
      rescue ArgumentError => e
        render_error(e.message, status: :bad_request)
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
        render_error(e.message, status: :bad_request)
      end

      # GET /api/v1/config_sync/master_records/:table
      # View master tenant's records for a specific table with sync preferences
      def master_records
        unless master_tenant
          return render_error("No master tenant found", status: :not_found)
        end

        table_config = TenantConfigSyncService::CONFIG_TABLES[params[:table]&.to_sym]
        unless table_config
          return render_error("Unknown table", status: :bad_request)
        end

        model = table_config[:model].constantize
        match_fields = table_config[:match_fields]

        # Get master records (respecting scope filters, e.g. contacts → price_only only)
        master_records = ActsAsTenant.with_tenant(master_tenant) do
          base = scoped_model(model, table_config)
          if params[:table] == "price_histories"
            # Only latest price per pricebook_item + supplier combo (same as pull_one_table)
            base
              .where("pricebook_item_id IS NOT NULL AND supplier_id IS NOT NULL")
              .select("DISTINCT ON (pricebook_item_id, supplier_id) price_histories.*")
              .order(:pricebook_item_id, :supplier_id, "date_effective DESC NULLS LAST", "created_at DESC")
          else
            base.order(table_config[:name_field])
          end
        end

        # Get sync preferences for master records
        preferences = TenantSyncPreference.modes_for_type(table_config[:model], tenant: master_tenant)

        # Get tenant's existing records for comparison (respecting scope filters)
        tenant_records_by_key = ActsAsTenant.with_tenant(current_tenant) do
          scoped_model(model, table_config).index_by { |r| match_key(r, match_fields) }
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
        render_error(e.message, status: :bad_request)
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

      # POST /api/v1/config_sync/pull_one_table
      # Pull a single table (called by frontend for live progress)
      #
      # Params:
      #   table: string - config table key (e.g. "job_types")
      #   batch_size: integer - optional, process N records at a time (default: all)
      #   offset: integer - optional, skip first N IDs (for batching)
      def pull_one_table
        table = params[:table]&.to_sym
        table_config = TenantConfigSyncService::CONFIG_TABLES[table]
        unless table_config
          return render_error("Unknown table: #{params[:table]}", status: :bad_request)
        end

        service = TenantConfigSyncService.new(current_tenant)
        is_master = current_tenant&.is_master_tenant? || false
        model = table_config[:model].constantize
        batch_size = params[:batch_size]&.to_i
        offset = params[:offset]&.to_i || 0

        # Allow overriding scope filter (e.g. contacts: price_only=false to sync ALL contacts)
        effective_config = table_config
        if params[:price_only] == "false" && table.in?([:contacts, :price_histories])
          effective_config = table_config.except(:scope)
        end

        if is_master
          # Allow explicit source tenant selection (from frontend dropdown)
          # Falls back to auto-selecting the tenant with the most records
          best_source = nil
          best_count = 0

          if params[:source_tenant_id].present?
            best_source = Tenant.find_by(id: params[:source_tenant_id])
            best_count = best_source ? ActsAsTenant.with_tenant(best_source) { scoped_model(model, effective_config).count } : 0
          end

          unless best_source && best_count > 0
            # Auto-select: find the tenant with the most records for this table
            source_tenants = Tenant.where(is_master_tenant: false).to_a
            source_tenants.each do |t|
              count = ActsAsTenant.with_tenant(t) { scoped_model(model, effective_config).count }
              if count > best_count
                best_count = count
                best_source = t
              end
            end
          end

          unless best_source && best_count > 0
            return render json: {
              success: true, table: table.to_s,
              imported: 0, updated: 0, skipped: 0, total: 0, total_records: 0,
              has_more: false,
              message: "No source records found"
            }
          end

          # Use scope from config (SSoT) — e.g. contacts → price_only, price_histories → price_only suppliers
          all_ids = ActsAsTenant.with_tenant(best_source) do
            base = scoped_model(model, effective_config)
            if table == :price_histories
              # Only latest price per pricebook_item + supplier combo
              base
                .where("pricebook_item_id IS NOT NULL AND supplier_id IS NOT NULL")
                .select("DISTINCT ON (pricebook_item_id, supplier_id) price_histories.id")
                .order(:pricebook_item_id, :supplier_id, "date_effective DESC NULLS LAST", "created_at DESC")
                .pluck(:id)
            else
              base.pluck(:id)
            end
          end

          if table_config[:remap_fks].present?
            all_ids = filter_ids_by_existing_fks(
              all_ids, model, best_source, table_config[:remap_fks]
            )
          end

          if all_ids.empty?
            return render json: {
              success: true, table: table.to_s,
              imported: 0, updated: 0, skipped: 0, total: 0, total_records: 0,
              has_more: false,
              source: best_source.name, message: "All FK-filtered out"
            }
          end

          total_records = all_ids.length
          batch_ids = if batch_size && batch_size > 0
            all_ids.sort[offset, batch_size] || []
          else
            all_ids
          end
          has_more = batch_size && batch_size > 0 && (offset + batch_size) < total_records

          if batch_ids.empty?
            return render json: {
              success: true, table: table.to_s,
              imported: 0, updated: 0, skipped: 0, total: 0, total_records: total_records,
              has_more: false, source: best_source.name
            }
          end

          # Clean slate for price_histories: delete all existing before importing latest-only.
          # Only on first batch (offset=0) to avoid re-deleting on subsequent batches.
          deleted_count = 0
          if table == :price_histories && offset == 0
            deleted_count = ActsAsTenant.with_tenant(current_tenant) do
              price_only_ids = Contact.where(entity_type: "price_only").pluck(:id)
              PriceHistory.where(supplier_id: price_only_ids).delete_all
            end
            Rails.logger.info "[ConfigSync] Clean slate: deleted #{deleted_count} price histories before import"
          end

          result = service.import_from_tenant(
            source_tenant: best_source,
            table: table.to_s,
            record_ids: batch_ids
          )

          imported_count = result[:imported]&.length || 0
          skipped_count = result[:skipped]&.length || 0
          error_count = result[:errors]&.length || 0

          # Log failures for debugging
          if skipped_count > 0 || error_count > 0
            Rails.logger.warn "[ConfigSync] #{table}: #{imported_count} imported, #{skipped_count} skipped, #{error_count} errors"
            result[:skipped]&.first(3)&.each { |s| Rails.logger.warn "  Skipped: #{s[:name]} - #{s[:reason]}" }
            result[:errors]&.first(3)&.each { |e| Rails.logger.warn "  Error: #{e}" }
          end

          # Record per-table sync timestamp (only on last batch or single batch)
          record_table_sync(table, imported: imported_count, updated: 0, skipped: skipped_count) unless has_more

          render json: {
            success: true, table: table.to_s,
            imported: imported_count,
            updated: 0,
            skipped: skipped_count,
            total: batch_ids.length,
            total_records: total_records,
            has_more: has_more,
            next_offset: has_more ? offset + batch_size : nil,
            source: best_source.name,
            errors: result[:errors]&.first(5),
            skipped_reasons: result[:skipped]&.first(5)&.map { |s| "#{s[:name]}: #{s[:reason]}" }
          }
        else
          # Non-master tenant: pull from master (respecting scope filters)
          all_ids = ActsAsTenant.with_tenant(master_tenant) { scoped_model(model, effective_config).pluck(:id) }

          if all_ids.empty?
            return render json: {
              success: true, table: table.to_s,
              imported: 0, updated: 0, skipped: 0, total: 0, total_records: 0,
              has_more: false,
              message: "No source records found"
            }
          end

          # FRC (Feb 2026): Filter by FK availability BEFORE pulling, same as master flow.
          # Without this, records whose FK targets don't exist in the tenant would all fail
          # during remap_foreign_key and be counted as "failed" instead of "filtered out".
          original_count = all_ids.length
          if table_config[:remap_fks].present?
            all_ids = filter_ids_by_existing_fks(
              all_ids, model, master_tenant, table_config[:remap_fks]
            )
          end

          if all_ids.empty? && original_count > 0
            return render json: {
              success: true, table: table.to_s,
              imported: 0, updated: 0, skipped: 0, total: 0, total_records: original_count,
              has_more: false,
              message: "All FK-filtered out"
            }
          end

          total_records = all_ids.length
          batch_ids = if batch_size && batch_size > 0
            all_ids.sort[offset, batch_size] || []
          else
            all_ids
          end
          has_more = batch_size && batch_size > 0 && (offset + batch_size) < total_records

          if batch_ids.empty?
            return render json: {
              success: true, table: table.to_s,
              imported: 0, updated: 0, skipped: 0, total: 0, total_records: total_records,
              has_more: false
            }
          end

          result = service.pull_from_master(
            table: table.to_s,
            record_ids: batch_ids,
            mode: :replace_existing
          )

          imported_count = result[:imported]&.length || 0
          updated_count = result[:updated]&.length || 0
          skipped_count = result[:skipped]&.length || 0
          error_count = result[:errors]&.length || 0

          if skipped_count > 0 || error_count > 0
            Rails.logger.warn "[ConfigSync] #{table}: #{imported_count} imported, #{updated_count} updated, #{skipped_count} skipped, #{error_count} errors"
            result[:skipped]&.first(3)&.each { |s| Rails.logger.warn "  Skipped: #{s[:name]} - #{s[:reason]}" }
            result[:errors]&.first(3)&.each { |e| Rails.logger.warn "  Error: #{e}" }
          end

          # Record per-table sync timestamp (only on last batch or single batch)
          record_table_sync(table, imported: imported_count, updated: updated_count, skipped: skipped_count) unless has_more

          render json: {
            success: true, table: table.to_s,
            imported: imported_count,
            updated: updated_count,
            skipped: skipped_count,
            total: batch_ids.length,
            total_records: total_records,
            has_more: has_more,
            next_offset: has_more ? offset + batch_size : nil,
            errors: result[:errors]&.first(5),
            skipped_reasons: result[:skipped]&.first(5)&.map { |s| "#{s[:name]}: #{s[:reason]}" }
          }
        end
      rescue => e
        render json: {
          success: false, table: params[:table],
          error: e.message
        }, status: :unprocessable_entity
      end

      # POST /api/v1/config_sync/pull_all
      # Fresh pull of ALL records from ALL tables
      #
      # For non-master tenants: pulls FROM master (standard flow)
      # For master tenant: pulls from the largest non-master tenant per table
      #   (aggregates tenant config data into master)
      def pull_all
        service = TenantConfigSyncService.new(current_tenant)
        is_master = current_tenant&.is_master_tenant? || false
        results = {}
        total_imported = 0
        total_updated = 0
        total_skipped = 0
        errors = []

        # For master tenant, find source tenants to import from
        source_tenants = is_master ? Tenant.where(is_master_tenant: false).to_a : []

        TenantConfigSyncService::CONFIG_TABLES.each_key do |table|
          table_config = TenantConfigSyncService::CONFIG_TABLES[table]
          model = table_config[:model].constantize

          if is_master
            # Master tenant: skip contact_types (not needed in master)
            next if table == :contact_types

            # Master tenant: import from the tenant with the most records for this table
            best_source = nil
            best_count = 0

            source_tenants.each do |t|
              count = ActsAsTenant.with_tenant(t) { scoped_model(model, table_config).count }
              if count > best_count
                best_count = count
                best_source = t
              end
            end

            next unless best_source && best_count > 0

            begin
              # Use scope from config (SSoT) — e.g. contacts → price_only, price_histories → price_only suppliers
              all_ids = ActsAsTenant.with_tenant(best_source) do
                base = scoped_model(model, table_config)
                if table == :price_histories
                  # Only latest price per pricebook_item + supplier combo
                  base
                    .where("pricebook_item_id IS NOT NULL AND supplier_id IS NOT NULL")
                    .select("DISTINCT ON (pricebook_item_id, supplier_id) price_histories.id")
                    .order(:pricebook_item_id, :supplier_id, "date_effective DESC NULLS LAST", "created_at DESC")
                    .pluck(:id)
                else
                  base.pluck(:id)
                end
              end

              # For tables with FK dependencies (e.g. price_histories needs matching
              # contacts + pricebook_items), filter to only records whose FKs exist
              # in the current tenant. No point importing orphaned records.
              if table_config[:remap_fks].present?
                all_ids = filter_ids_by_existing_fks(
                  all_ids, model, best_source, table_config[:remap_fks]
                )
              end

              next if all_ids.empty?

              # Clean slate for price_histories: delete all existing before importing latest-only
              if table == :price_histories
                ActsAsTenant.with_tenant(current_tenant) do
                  price_only_ids = Contact.where(entity_type: "price_only").pluck(:id)
                  deleted = PriceHistory.where(supplier_id: price_only_ids).delete_all
                  Rails.logger.info "[ConfigSync] Clean slate: deleted #{deleted} price histories before pull_all import"
                end
              end

              result = service.import_from_tenant(
                source_tenant: best_source,
                table: table.to_s,
                record_ids: all_ids
              )

              imported_count = result[:imported]&.length || 0
              skipped_count = result[:skipped]&.length || 0

              results[table.to_s] = {
                imported: imported_count,
                updated: 0,
                skipped: skipped_count,
                total: all_ids.length,
                source: best_source.name
              }

              total_imported += imported_count
              total_skipped += skipped_count

              record_table_sync(table, imported: imported_count, updated: 0, skipped: skipped_count)
            rescue => e
              errors << "#{table}: #{e.message}"
              results[table.to_s] = { error: e.message }
            end
          else
            # Non-master tenant: pull from master (respecting scope filters)
            all_ids = ActsAsTenant.with_tenant(master_tenant) { scoped_model(model, table_config).pluck(:id) }

            next if all_ids.empty?

            # FRC (Feb 2026): Filter by FK availability before pulling
            if table_config[:remap_fks].present?
              all_ids = filter_ids_by_existing_fks(
                all_ids, model, master_tenant, table_config[:remap_fks]
              )
              next if all_ids.empty?
            end

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

              record_table_sync(table, imported: imported_count, updated: updated_count, skipped: skipped_count)
            rescue => e
              errors << "#{table}: #{e.message}"
              results[table.to_s] = { error: e.message }
            end
          end
        end

        # Record last sync timestamp for audit trail
        if errors.empty? && current_tenant&.tenant_setting
          current_tenant.tenant_setting.update_columns(
            last_config_sync_at: Time.current,
            last_config_sync_by: current_user&.email
          )
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
          errors: errors.presence,
          last_config_sync_at: current_tenant&.tenant_setting&.last_config_sync_at&.iso8601,
          last_config_sync_by: current_tenant&.tenant_setting&.last_config_sync_by
        }
      end

      # POST /api/v1/config_sync/record_sync
      # Record that a full sync was performed (called by frontend after pull_all completes)
      def record_sync
        if current_tenant&.tenant_setting
          current_tenant.tenant_setting.update_columns(
            last_config_sync_at: Time.current,
            last_config_sync_by: current_user&.email
          )
          render json: {
            success: true,
            last_config_sync_at: current_tenant.tenant_setting.last_config_sync_at.iso8601,
            last_config_sync_by: current_tenant.tenant_setting.last_config_sync_by
          }
        else
          render_error("No tenant setting found", status: :not_found)
        end
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
          return render_error("No master tenant found", status: :not_found)
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
        render_error(e.message, status: :bad_request)
      end

      private

      def require_teeem_staff!
        return if current_user&.teeem_staff?

        render_error("TEEEM staff access required", status: :forbidden)
      end

      def require_admin!
        return if current_user&.admin?

        render_error("Admin access required", status: :forbidden)
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

      # Record per-table sync timestamp for audit trail
      def record_table_sync(table_key, imported: 0, updated: 0, skipped: 0)
        return unless current_tenant&.tenant_setting

        ts = current_tenant.tenant_setting
        timestamps = (ts.config_sync_table_timestamps || {}).dup
        timestamps[table_key.to_s] = {
          "at" => Time.current.iso8601,
          "by" => current_user&.email,
          "imported" => imported,
          "updated" => updated,
          "skipped" => skipped
        }
        ts.update_columns(config_sync_table_timestamps: timestamps)
      end

      def pull_params
        params.permit(:table, :mode, :price_markup_percent, record_ids: [])
      end

      def push_params
        params.permit(:table, record_ids: [])
      end

      # Apply config[:scope] lambda if present, otherwise return model.all
      # Mirrors TenantConfigSyncService#scoped_query — SSoT for scope application
      def scoped_model(model, table_config)
        if table_config[:scope]
          model.instance_exec(&table_config[:scope])
        else
          model.all
        end
      end

      # Filter source record IDs to only those whose FK targets exist in current tenant.
      # e.g. for price_histories, only include records where the supplier (Contact)
      # and pricebook_item (PricebookItem) already exist in the current tenant.
      def filter_ids_by_existing_fks(source_ids, model, source_tenant, remap_fks)
        return source_ids if remap_fks.blank?

        # FRC (Feb 2026): Skip self-referential FKs (e.g. warehouse_folders.parent_id).
        # The service handles these with a two-pass import (defer parent_id to pass 2).
        # Pre-filtering them here creates a chicken-and-egg problem: new child records
        # get filtered out because their new parent hasn't been synced yet.
        non_self_ref_fks = remap_fks.reject { |_f, c| c[:model] == model.name }
        return source_ids if non_self_ref_fks.blank?

        # Load source records with their FK values
        source_records = ActsAsTenant.with_tenant(source_tenant) do
          model.where(id: source_ids)
        end

        # Build lookup sets for each FK: { match_value => true }
        # These are the values that exist in the current (target) tenant
        target_values = {}
        non_self_ref_fks.each do |fk_field, remap_config|
          fk_model = remap_config[:model].constantize
          match_field = remap_config[:match_field]
          target_values[fk_field] = ActsAsTenant.with_tenant(current_tenant) do
            Set.new(fk_model.pluck(match_field).map { |v| v.to_s.downcase.strip })
          end
        end

        # Build source FK value lookups (source_id → match_value)
        source_fk_values = {}
        non_self_ref_fks.each do |fk_field, remap_config|
          fk_model = remap_config[:model].constantize
          match_field = remap_config[:match_field]
          if remap_config[:array]
            # Array FK: collect all IDs from all array values
            source_fk_ids = source_records.flat_map { |r| Array(r.send(fk_field)) }.compact.uniq
          else
            source_fk_ids = source_records.map { |r| r.send(fk_field) }.compact.uniq
          end
          source_fk_values[fk_field] = ActsAsTenant.with_tenant(source_tenant) do
            fk_model.where(id: source_fk_ids).pluck(:id, match_field).to_h
          end
        end

        # Filter: keep only records where ALL non-self-ref FKs have a matching target
        # Note: Needs full records to call .send(fk_field), can't use SQL-only filtering
        kept_ids = source_records.select do |record|
          non_self_ref_fks.all? do |fk_field, remap_config|
            fk_value = record.send(fk_field)
            next true if fk_value.blank? # Optional FK, allow nil

            if remap_config[:array] && fk_value.is_a?(Array)
              # Array FK: keep record if at least one element has a match
              next true if fk_value.empty?
              fk_value.any? do |id|
                sv = source_fk_values[fk_field][id]
                sv && target_values[fk_field].include?(sv.to_s.downcase.strip)
              end
            else
              source_value = source_fk_values[fk_field][fk_value]
              next false unless source_value
              target_values[fk_field].include?(source_value.to_s.downcase.strip)
            end
          end
        end.map(&:id)

        Rails.logger.info "[ConfigSync] FK filter for #{model.name}: #{source_ids.length} → #{kept_ids.length} (#{source_ids.length - kept_ids.length} filtered out)"
        kept_ids
      end
    end
  end
end
