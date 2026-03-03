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
          dependencies: TenantConfigSyncService.table_dependencies,
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

        # Compute sync coverage: how many local records are linked to master vs local-only
        if master_tenant
          response[:sync_coverage] = compute_sync_coverage
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

        # Check if dependency tables have records in current tenant (only on first batch)
        dependency_warnings = []
        if offset == 0
          deps = TenantConfigSyncService.table_dependencies[table.to_s] || []
          deps.each do |dep_table_key|
            dep_config = TenantConfigSyncService::CONFIG_TABLES[dep_table_key.to_sym]
            next unless dep_config

            dep_model = dep_config[:model].constantize
            dep_count = ActsAsTenant.with_tenant(current_tenant) { dep_model.count }
            if dep_count == 0
              dep_label = dep_config[:model].underscore.humanize.pluralize
              dependency_warnings << "#{dep_label} must be synced first (0 records found)"
            end
          end
        end

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
            skipped_reasons: result[:skipped]&.first(5)&.map { |s| "#{s[:name]}: #{s[:reason]}" },
            dependency_warnings: dependency_warnings.presence
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

          # Filter out master records for per-record "independent" overrides
          independent_excluded = exclude_independent_master_ids(table, all_ids, model, effective_config)
          all_ids -= independent_excluded if independent_excluded.any?

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

          # FRC: two_way tables own their records locally — pull only adds NEW records,
          # never overwrites existing local values (Tekna pushes changes UP to TEEEM,
          # not the other way). one_way tables always replace with master's version.
          pull_mode = table_mode(table) == "two_way" ? :add_new : :replace_existing

          result = service.pull_from_master(
            table: table.to_s,
            record_ids: batch_ids,
            mode: pull_mode
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

          # ── Two-way: push local-only records up to TEEEM (on last batch) ──
          pushed_count = 0
          if !has_more && table_mode(table) == "two_way"
            push_result = service.push_local_only_to_master(table: table.to_s)
            pushed_count = push_result[:pushed] || 0
          end

          # ── Orphan cleanup: delete local records no longer in TEEEM (on last batch) ──
          # Handles records deleted from master propagating down on regular sync.
          # Applies to two_way and one_way tables (independent = tenant manages its own).
          deleted_orphans = 0
          if !has_more && table_mode(table).in?(%w[two_way one_way])
            orphan_result = service.delete_orphaned_from_master(table: table.to_s)
            deleted_orphans = orphan_result[:deleted]
          end

          # Record per-table sync timestamp (only on last batch or single batch)
          record_table_sync(table, imported: imported_count, updated: updated_count, skipped: skipped_count) unless has_more

          render json: {
            success: true, table: table.to_s,
            imported: imported_count,
            updated: updated_count,
            skipped: skipped_count,
            pushed: pushed_count,
            deleted_orphans: deleted_orphans,
            total: batch_ids.length,
            total_records: total_records,
            has_more: has_more,
            next_offset: has_more ? offset + batch_size : nil,
            errors: result[:errors]&.first(5),
            skipped_reasons: result[:skipped]&.first(5)&.map { |s| "#{s[:name]}: #{s[:reason]}" },
            dependency_warnings: dependency_warnings.presence
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

      # GET /api/v1/config_sync/diff_all/:table
      # Compare one table across ALL tenants side-by-side (master tenant only)
      def diff_all
        unless current_tenant&.is_master_tenant?
          return render_error("Master tenant only", status: :forbidden)
        end

        service = TenantConfigSyncService.new(current_tenant)
        result = service.diff_all_tenants(params[:table])

        if result[:error]
          render_error(result[:error], status: :unprocessable_entity)
        else
          render json: { success: true, **result }
        end
      rescue ArgumentError => e
        render_error(e.message, status: :bad_request)
      end

      # POST /api/v1/config_sync/apply_winners
      # Apply winner selections — push winning tenant's version to all other tenants
      def apply_winners
        unless current_tenant&.is_master_tenant?
          return render_error("Master tenant only", status: :forbidden)
        end

        table = params[:table]
        selections = params[:selections] || []

        if table.blank? || selections.empty?
          return render_error("table and selections are required", status: :bad_request)
        end

        service = TenantConfigSyncService.new(current_tenant)
        result = service.apply_winners(table, selections)

        render json: { success: result[:success], **result }
      rescue ArgumentError => e
        render_error(e.message, status: :bad_request)
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

      # POST /api/v1/config_sync/toggle_template_sync
      # Toggle a SM template between synced (Two-way) and independent
      # Synced = has sync_key matching master, Independent = sync_key is nil
      def toggle_template_sync
        template = SmScheduleMasterTemplate.find(params[:template_id])

        if template.sync_key.present?
          # Disconnect: remove sync_key → becomes independent
          template.update!(sync_key: nil)
          render json: { success: true, synced: false, name: template.name }
        else
          # Reconnect: regenerate sync_key from name → becomes two-way (if master has match)
          new_key = SmScheduleMasterTemplate.build_sync_key(template.name)
          template.update!(sync_key: new_key)
          render json: { success: true, synced: true, sync_key: new_key, name: template.name }
        end
      end

      # POST /api/v1/config_sync/toggle_record_sync
      # Toggle any ConfigSyncable record between synced and independent
      # Params: table_key (e.g. "quote_templates"), record_id
      # Dynamic toggle: any ConfigSyncable model in CONFIG_TABLES can be toggled
      def toggle_record_sync
        table_key = params[:table_key]&.to_sym
        config = TenantConfigSyncService::CONFIG_TABLES[table_key]
        return render json: { success: false, error: "Unknown table" }, status: :unprocessable_entity unless config

        model = config[:model].constantize
        return render json: { success: false, error: "Table not syncable" }, status: :unprocessable_entity unless model.column_names.include?("sync_key")

        record = model.find(params[:record_id])
        record_name = record.try(:name) || record.try(config[:name_field]) || record.id.to_s

        if record.sync_key.present?
          record.update!(sync_key: nil)
          render json: { success: true, synced: false, name: record_name }
        else
          sources = Array(model.sync_key_source)
          parts = sources.map { |field| record.send(field).to_s.strip }
          new_key = model.build_sync_key(*parts)
          record.update!(sync_key: new_key)
          render json: { success: true, synced: true, sync_key: new_key, name: record_name }
        end
      end

      # GET /api/v1/config_sync/table_modes
      # Returns per-table sync direction preferences for current tenant
      def table_modes
        modes = current_tenant&.tenant_setting&.config_sync_table_modes || {}
        render json: { success: true, modes: modes }
      end

      # PUT /api/v1/config_sync/update_table_mode
      # Set sync direction for a single table
      #
      # Params:
      #   table: string - config table key (e.g. "sm_trades")
      #   mode: string - "two_way" | "one_way" | "independent"
      def update_table_mode
        table_key = params[:table]
        mode = params[:mode]
        record_id = params[:record_id]
        record_name = params[:record_name]  # Used for master-only records that have no local ID

        unless table_key.present? && mode.present?
          return render_error("table and mode are required", status: :bad_request)
        end

        valid_modes = %w[two_way one_way independent]
        unless valid_modes.include?(mode)
          return render_error("mode must be one of: #{valid_modes.join(', ')}", status: :bad_request)
        end

        ts = current_tenant&.tenant_setting
        unless ts
          return render_error("No tenant setting found", status: :not_found)
        end

        modes = (ts.config_sync_table_modes || {}).dup
        # Per-record override: "table_key:record_id" for local records,
        # "table_key:master:lowercase_name" for master-only records (no local ID),
        # "table_key" for table-level override
        mode_key = if record_name.present?
          "#{table_key}:master:#{record_name.downcase}"
        elsif record_id.present?
          "#{table_key}:#{record_id}"
        else
          table_key
        end
        modes[mode_key] = mode
        ts.update!(config_sync_table_modes: modes)

        # Cascade sync_key changes when mode changes
        # (master-only records have no local counterpart to cascade to)
        cascaded = 0
        cascade_error = nil
        begin
          config = TenantConfigSyncService::CONFIG_TABLES[table_key.to_sym]
          if config
            model = config[:model].constantize

            if record_id.present? && model.column_names.include?("sync_key")
              # Per-record: clear/regenerate sync_key for this specific record + its children
              record = model.find_by(id: record_id)
              if record
                if mode == "independent"
                  record.update_column(:sync_key, nil) if record.sync_key.present?
                  cascaded += 1
                  # Also clear children (PO Pack → Items → Line Items, Claim Template → Lines)
                  cascaded += cascade_clear_children(table_key, record)
                else
                  if record.sync_key.blank? && record.respond_to?(:generate_sync_key)
                    record.generate_sync_key
                    record.save! if record.sync_key_changed?
                    cascaded += 1
                  end
                  # Also regenerate children
                  cascaded += cascade_regenerate_children(table_key, record)
                end
              end
            elsif params[:cascade].present? && model.column_names.include?("sync_key")
              # Table-level: clear/regenerate ALL records
              if mode == "independent"
                cascaded = model.where.not(sync_key: nil).update_all(sync_key: nil)
              else
                model.where(sync_key: nil).find_each do |rec|
                  rec.generate_sync_key
                  if rec.sync_key_changed?
                    rec.save!
                    cascaded += 1
                  end
                end
              end
            end
          end
        rescue => e
          Rails.logger.warn "[ConfigSync] Cascade error for #{table_key}: #{e.message}"
          cascade_error = e.message
        end

        render json: { success: true, modes: modes, cascaded: cascaded, cascade_error: cascade_error }
      end

      # POST /api/v1/config_sync/cascade_push_table
      # TEEEM master only — push one table from TEEEM to ALL customer tenants.
      #
      # Phase 1 of cascade sync (Tekna → TEEEM) is done by the frontend via pull_one_table.
      # This endpoint handles Phase 2: TEEEM → all customers, including:
      #   1. Apply tombstones: propagate deletes from any tenant to TEEEM + all customers
      #   2. Push records: import/update TEEEM records into each customer
      #   3. Orphan cleanup: delete customer records with sync_key no longer in TEEEM
      #
      # Only applies to two_way and one_way tables (independent tables are skipped).
      def cascade_push_table
        return render json: { error: "Master tenant only" }, status: :forbidden unless current_tenant&.is_master_tenant?

        table     = params[:table].to_sym
        table_config = TenantConfigSyncService::CONFIG_TABLES[table]
        return render json: { error: "Unknown table: #{params[:table]}" }, status: :bad_request unless table_config

        model     = table_config[:model].constantize
        mode      = (params[:mode] || "replace_existing").to_sym
        customer_tenants = Tenant.where(is_master_tenant: false).to_a

        # ── Step 1: Apply tombstones from ALL tenants ──────────────────────────────────
        # Collect all pending deletions for this model type across all customer tenants.
        # Delete from TEEEM first, then from every other tenant, then mark propagated.
        tombstone_results = {}
        pending_tombstones = ConfigSyncDeletion.where(
          tenant_id: customer_tenants.map(&:id),
          model_type: table_config[:model],
          propagated_at: nil
        ).to_a

        if pending_tombstones.any?
          sync_keys_to_delete = pending_tombstones.map(&:sync_key).uniq

          # Delete from TEEEM master
          deleted_from_master = ActsAsTenant.with_tenant(current_tenant) do
            model.where(sync_key: sync_keys_to_delete).delete_all
          end
          tombstone_results[:deleted_from_master] = deleted_from_master

          # Delete from each customer tenant
          customer_tenants.each do |t|
            deleted = ActsAsTenant.with_tenant(t) do
              model.where(sync_key: sync_keys_to_delete).delete_all
            end
            tombstone_results[t.slug] ||= {}
            tombstone_results[t.slug][:tombstone_deleted] = deleted
          end

          # Mark propagated
          ConfigSyncDeletion.where(id: pending_tombstones.map(&:id))
                            .update_all(propagated_at: Time.current)
        end

        # ── Step 2 + 3: Push + orphan cleanup per customer tenant ─────────────────────
        # Get current TEEEM record IDs and sync_keys (after tombstone cleanup above).
        master_record_ids = ActsAsTenant.with_tenant(current_tenant) do
          scoped_model(model, table_config).pluck(:id)
        end

        master_sync_keys = ActsAsTenant.with_tenant(current_tenant) do
          base = table_config[:scope] ? model.instance_exec(&table_config[:scope]) : model.all
          base.where.not(sync_key: [nil, ""]).pluck(:sync_key)
        end

        results = {}
        customer_tenants.each do |t|
          # Skip if this customer has the table set to independent
          t_mode = table_mode(table, t)
          if t_mode == "independent"
            results[t.slug] = { skipped: true, reason: "independent mode" }
            next
          end

          svc = TenantConfigSyncService.new(t)

          # Push: import/update TEEEM records into customer
          pull_mode = t_mode == "two_way" ? :add_new : mode
          push_result = master_record_ids.empty? ? { imported: [], updated: [], skipped: [] } :
            svc.pull_from_master(table: table.to_s, record_ids: master_record_ids, mode: pull_mode)

          # Orphan cleanup: delete customer records with sync_key not in TEEEM
          orphan_result = master_sync_keys.any? ? svc.delete_orphaned_from_master(table: table) : { deleted: 0 }

          results[t.slug] = {
            imported:        push_result[:imported]&.length || 0,
            updated:         push_result[:updated]&.length  || 0,
            skipped:         push_result[:skipped]&.length  || 0,
            deleted_orphans: orphan_result[:deleted]
          }
          results[t.slug].merge!(tombstone_results[t.slug] || {})
        end

        render json: {
          success: true,
          table: table.to_s,
          tombstones: tombstone_results,
          results: results
        }
      rescue => e
        render json: { success: false, error: e.message }, status: :unprocessable_entity
      end

      private

      # Filter out master record IDs that correspond to tenant records set to "independent"
      # Per-record modes are stored as:
      #   "table_key:record_id" → "independent" for locally-existing records
      #   "table_key:master:lowercase_name" → "independent" for master-only records (no local ID)
      # For PO Items/Lines, record_id is the PACK id (grouped by pack in UI)
      def exclude_independent_master_ids(table_key, master_ids, model, config)
        modes = current_tenant&.tenant_setting&.config_sync_table_modes || {}
        prefix = "#{table_key}:"
        master_prefix = "#{table_key}:master:"

        # ID-based: "table:123" (only numeric suffixes — not "table:master:name")
        independent_record_ids = modes.select { |k, v|
          k.start_with?(prefix) && !k.start_with?(master_prefix) && v == "independent"
        }.map { |k, _| k.sub(prefix, "").to_i }.select { |id| id > 0 }

        # Name-based: "table:master:hia residential" (master-only records with no local ID)
        master_only_names = modes.select { |k, v|
          k.start_with?(master_prefix) && v == "independent"
        }.map { |k, _| k.sub(master_prefix, "") }

        return [] if independent_record_ids.empty? && master_only_names.empty?

        # Get names of independent records from tenant
        excluded_master_ids = []

        case table_key.to_s
        when "po_template_packs"
          # record_id is pack id — find master packs with same name
          names = PoTemplatePack.where(id: independent_record_ids).pluck(:name).map(&:downcase)
          names += master_only_names
          excluded_master_ids = ActsAsTenant.with_tenant(master_tenant) do
            PoTemplatePack.where("LOWER(name) IN (?)", names).pluck(:id)
          end if names.any?

        when "po_template_items"
          # record_id is PACK id (UI groups items by pack) — exclude master items in those packs
          pack_names = PoTemplatePack.where(id: independent_record_ids).pluck(:name).map(&:downcase)
          pack_names += master_only_names
          excluded_master_ids = ActsAsTenant.with_tenant(master_tenant) do
            master_pack_ids = PoTemplatePack.where("LOWER(name) IN (?)", pack_names).pluck(:id)
            PoTemplateItem.where(po_template_pack_id: master_pack_ids).pluck(:id)
          end if pack_names.any?

        when "po_template_line_items"
          # record_id is PACK id — exclude master line items in items of those packs
          pack_names = PoTemplatePack.where(id: independent_record_ids).pluck(:name).map(&:downcase)
          pack_names += master_only_names
          excluded_master_ids = ActsAsTenant.with_tenant(master_tenant) do
            master_pack_ids = PoTemplatePack.where("LOWER(name) IN (?)", pack_names).pluck(:id)
            master_item_ids = PoTemplateItem.where(po_template_pack_id: master_pack_ids).pluck(:id)
            PoTemplateLineItem.where(po_template_item_id: master_item_ids).pluck(:id)
          end if pack_names.any?

        when "claim_stage_template_lines"
          # record_id is template id — exclude master lines for that template
          # Also includes master-only names (templates not yet synced locally)
          tpl_names = ClaimStageTemplate.where(id: independent_record_ids).pluck(:name).map(&:downcase)
          tpl_names += master_only_names
          excluded_master_ids = ActsAsTenant.with_tenant(master_tenant) do
            master_tpl_ids = ClaimStageTemplate.where("LOWER(name) IN (?)", tpl_names).pluck(:id)
            ClaimStageTemplateLine.where(claim_stage_template_id: master_tpl_ids).pluck(:id)
          end if tpl_names.any?

        when "tenders"
          # record_id is tender_header id
          header_names = TenderHeader.where(id: independent_record_ids).pluck(:name).map(&:downcase)
          header_names += master_only_names
          excluded_master_ids = ActsAsTenant.with_tenant(master_tenant) do
            master_header_ids = TenderHeader.where("LOWER(name) IN (?)", header_names).pluck(:id)
            Tender.where(tender_header_id: master_header_ids).pluck(:id)
          end if header_names.any?

        when "sm_schedule_masters"
          # SM Tasks: record_id is template id (sub-rows grouped by template) — exclude master tasks
          tmpl_names = SmScheduleMasterTemplate.where(id: independent_record_ids).pluck(:name).map(&:downcase)
          tmpl_names += master_only_names
          excluded_master_ids = ActsAsTenant.with_tenant(master_tenant) do
            master_tmpl_ids = SmScheduleMasterTemplate.where("LOWER(name) IN (?)", tmpl_names).pluck(:id)
            SmScheduleMaster.where(sm_schedule_master_template_id: master_tmpl_ids).pluck(:id)
          end if tmpl_names.any?

        when "sm_schedule_master_templates"
          # SM Templates: record_id is the template id itself
          names = SmScheduleMasterTemplate.where(id: independent_record_ids).pluck(:name).map(&:downcase)
          names += master_only_names
          excluded_master_ids = ActsAsTenant.with_tenant(master_tenant) do
            SmScheduleMasterTemplate.where("LOWER(name) IN (?)", names).pluck(:id)
          end if names.any?

        else
          # Generic: record_id is the actual record id — match by name
          name_col = %w[name display_name item_name].find { |c| model.column_names.include?(c) } || "name"
          names = model.where(id: independent_record_ids).pluck(name_col.to_sym).compact.map(&:downcase)
          names += master_only_names
          if names.any?
            excluded_master_ids = ActsAsTenant.with_tenant(master_tenant) do
              model.where("LOWER(#{name_col}) IN (?)", names).pluck(:id)
            end
          end
        end

        excluded_master_ids & master_ids  # Only exclude IDs that are actually in the list
      rescue => e
        Rails.logger.warn "[ConfigSync] exclude_independent_master_ids error: #{e.message}"
        []
      end

      # Clear sync_keys on child records when parent set to independent
      # e.g. PO Pack → its Items → its Line Items
      def cascade_clear_children(table_key, record)
        count = 0
        case table_key.to_s
        when "po_template_packs"
          record.po_template_items.each do |item|
            item.update_column(:sync_key, nil) if item.sync_key.present?
            count += 1
            item.po_template_line_items.where.not(sync_key: nil).update_all(sync_key: nil).tap { |n| count += n }
          end
        when "claim_stage_templates"
          count += record.lines.where.not(sync_key: nil).update_all(sync_key: nil)
        when "tender_headers"
          count += Tender.where(tender_header_id: record.id).where.not(sync_key: nil).update_all(sync_key: nil)
        when "sm_schedule_master_templates"
          # Template → clear sync_keys on all SM tasks belonging to this template
          count += SmScheduleMaster.where(sm_schedule_master_template_id: record.id)
                                   .where.not(sync_key: nil).update_all(sync_key: nil)
        when "sm_schedule_masters"
          # Task → clear sync_key on the parent template (bidirectional)
          tmpl = record.sm_schedule_master_template
          if tmpl&.sync_key.present?
            tmpl.update_column(:sync_key, nil)
            count += 1
          end
        end
        count
      end

      # Regenerate sync_keys on child records when parent set back to two_way/one_way
      def cascade_regenerate_children(table_key, record)
        count = 0
        case table_key.to_s
        when "po_template_packs"
          record.po_template_items.where(sync_key: nil).find_each do |item|
            item.generate_sync_key if item.respond_to?(:generate_sync_key)
            if item.sync_key_changed?
              item.save!
              count += 1
            end
            item.po_template_line_items.where(sync_key: nil).find_each do |line|
              line.generate_sync_key if line.respond_to?(:generate_sync_key)
              if line.sync_key_changed?
                line.save!
                count += 1
              end
            end
          end
        when "claim_stage_templates"
          record.lines.where(sync_key: nil).find_each do |line|
            line.generate_sync_key if line.respond_to?(:generate_sync_key)
            if line.sync_key_changed?
              line.save!
              count += 1
            end
          end
        when "tender_headers"
          Tender.where(tender_header_id: record.id, sync_key: nil).find_each do |t|
            t.generate_sync_key if t.respond_to?(:generate_sync_key)
            if t.sync_key_changed?
              t.save!
              count += 1
            end
          end
        when "sm_schedule_master_templates"
          # Template → regenerate sync_keys on all SM tasks belonging to this template
          SmScheduleMaster.where(sm_schedule_master_template_id: record.id, sync_key: [nil, ""]).find_each do |task|
            task.generate_sync_key if task.respond_to?(:generate_sync_key)
            if task.sync_key_changed?
              task.save!
              count += 1
            end
          end
        when "sm_schedule_masters"
          # Task → regenerate sync_key on the parent template (bidirectional)
          tmpl = record.sm_schedule_master_template
          if tmpl && tmpl.sync_key.blank? && tmpl.respond_to?(:generate_sync_key)
            tmpl.generate_sync_key
            if tmpl.sync_key_changed?
              tmpl.save!
              count += 1
            end
          end
        end
        count
      end

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

      # Get the sync mode for a single table (from tenant's config_sync_table_modes)
      # Pass an explicit tenant to check another tenant's preference (used in cascade_push_table).
      def table_mode(table_key, for_tenant = current_tenant)
        (for_tenant&.tenant_setting&.config_sync_table_modes || {})[table_key.to_s]
      end

      # Compute sync coverage per table: linked (match in master) vs local_only vs master_only
      # For master tenant: computes per non-master tenant
      # For non-master: computes vs master
      def compute_sync_coverage
        coverage = {}
        is_master = current_tenant&.is_master_tenant? || false

        # Pre-compute master keys per table (shared across all tenant comparisons)
        master_keys_cache = {}
        TenantConfigSyncService::CONFIG_TABLES.each do |table_key, config|
          begin
            model = config[:model].constantize
            master_keys_cache[table_key] = ActsAsTenant.with_tenant(master_tenant) do
              pluck_match_keys(model, config)
            end
          rescue => e
            Rails.logger.warn "[ConfigSync] Coverage error for #{table_key}: #{e.message}"
          end
        end

        # Pre-compute master template sync_keys (for SM Tasks template breakdown)
        master_template_keys = ActsAsTenant.with_tenant(master_tenant) do
          SmScheduleMasterTemplate.where.not(sync_key: nil).pluck(:sync_key).to_set
        end rescue Set.new

        # Pre-compute master sync_keys per ConfigSyncable table (for per-record breakdown)
        # IMPORTANT: sync_keys are slugified (hyphens) vs match_keys (spaces) — must use actual sync_keys
        master_sync_keys_cache = {}
        TenantConfigSyncService::CONFIG_TABLES.each do |table_key, config|
          begin
            model = config[:model].constantize
            next unless model.method_defined?(:sync_key) && model.column_names.include?("sync_key")
            master_sync_keys_cache[table_key] = ActsAsTenant.with_tenant(master_tenant) do
              model.where.not(sync_key: nil).pluck(:sync_key).to_set
            end
          rescue => e
            Rails.logger.warn "[ConfigSync] Sync keys error for #{table_key}: #{e.message}"
          end
        end

        if is_master
          # Master: compute coverage per non-master tenant (keyed by tenant slug)
          non_master_tenants = Tenant.where(is_master_tenant: false).to_a
          TenantConfigSyncService::CONFIG_TABLES.each do |table_key, config|
            master_keys = master_keys_cache[table_key]
            next unless master_keys

            begin
              model = config[:model].constantize
              per_tenant = {}
              non_master_tenants.each do |t|
                tenant_keys = ActsAsTenant.with_tenant(t) do
                  pluck_match_keys(model, config)
                end
                linked = (master_keys & tenant_keys).size
                entry = {
                  linked: linked,
                  local_only: tenant_keys.size - linked,
                  master_only: master_keys.size - linked
                }

                # SM Tasks: add per-template breakdown
                if table_key == :sm_schedule_masters
                  entry[:templates] = ActsAsTenant.with_tenant(t) do
                    template_breakdown(master_template_keys)
                  end
                end

                # Per-record breakdown for all ConfigSyncable tables
                # PO Items & Line Items grouped by parent pack for consistency
                if table_key == :po_template_items || table_key == :po_template_line_items
                  master_pack_keys = master_sync_keys_cache[:po_template_packs] || Set.new
                  entry[:records] = ActsAsTenant.with_tenant(t) do
                    table_key == :po_template_items ? po_items_by_pack(master_pack_keys) : po_lines_by_pack(master_pack_keys)
                  end
                elsif table_key == :claim_stage_template_lines
                  master_claim_keys = master_sync_keys_cache[:claim_stage_templates] || Set.new
                  entry[:records] = ActsAsTenant.with_tenant(t) do
                    claim_lines_by_template(master_claim_keys)
                  end
                elsif table_key != :sm_schedule_masters && model.column_names.include?("sync_key")
                  mk = master_sync_keys_cache[table_key] || Set.new
                  entry[:records] = ActsAsTenant.with_tenant(t) do
                    syncable_records_breakdown(model, mk)
                  end
                end

                per_tenant[t.slug] = entry
              end
              coverage[table_key.to_s] = per_tenant
            rescue => e
              Rails.logger.warn "[ConfigSync] Coverage error for #{table_key}: #{e.message}"
            end
          end
        else
          # Non-master: compare vs master
          TenantConfigSyncService::CONFIG_TABLES.each do |table_key, config|
            master_keys = master_keys_cache[table_key]
            next unless master_keys

            begin
              model = config[:model].constantize
              local_keys = ActsAsTenant.with_tenant(current_tenant) do
                pluck_match_keys(model, config)
              end

              linked = (master_keys & local_keys).size
              entry = {
                linked: linked,
                local_only: local_keys.size - linked,
                master_only: master_keys.size - linked
              }

              # SM Tasks: combined breakdown showing master + local counts per template
              if table_key == :sm_schedule_masters
                entry[:templates] = combined_template_breakdown(master_template_keys)
              end

              # Per-record breakdown with BOTH master and local counts
              # PO Items & Line Items grouped by parent pack for consistency
              if table_key == :po_template_items || table_key == :po_template_line_items
                master_pack_keys = master_sync_keys_cache[:po_template_packs] || Set.new
                entry[:records] = table_key == :po_template_items ? combined_po_items_by_pack(master_pack_keys) : combined_po_lines_by_pack(master_pack_keys)
              elsif table_key == :claim_stage_template_lines
                master_claim_keys = master_sync_keys_cache[:claim_stage_templates] || Set.new
                entry[:records] = combined_claim_lines_by_template(master_claim_keys)
              elsif table_key != :sm_schedule_masters && model.column_names.include?("sync_key")
                mk = master_sync_keys_cache[table_key] || Set.new
                entry[:records] = combined_syncable_records_breakdown(model, mk)
              end

              coverage[table_key.to_s] = entry
            rescue => e
              Rails.logger.warn "[ConfigSync] Coverage error for #{table_key}: #{e.message}"
            end
          end
        end

        coverage
      end

      # SM Tasks: per-template breakdown showing synced vs independent
      # For master path: simple single-tenant breakdown
      # Must be called within ActsAsTenant.with_tenant context
      def template_breakdown(master_template_keys)
        SmScheduleMasterTemplate.all.map do |t|
          task_count = SmScheduleMaster.for_template(t.id).count
          synced = t.sync_key.present? && master_template_keys.include?(t.sync_key)
          { id: t.id, name: t.name, tasks: task_count, synced: synced }
        end
      end

      # SM Tasks: combined breakdown showing BOTH master and local task counts per template
      # Shows master templates as the SSoT, cross-referenced with local data
      def combined_template_breakdown(master_template_keys)
        # Get master templates + task counts
        master_templates = ActsAsTenant.with_tenant(master_tenant) do
          SmScheduleMasterTemplate.all.map do |t|
            tasks = SmScheduleMaster.for_template(t.id).count
            { id: t.id, name: t.name, sync_key: t.sync_key, tasks: tasks }
          end
        end

        # Get local templates + task counts (current tenant context)
        local_templates = SmScheduleMasterTemplate.all.map do |t|
          tasks = SmScheduleMaster.for_template(t.id).count
          { id: t.id, name: t.name, sync_key: t.sync_key, tasks: tasks }
        end

        # Build local lookup by sync_key
        local_by_key = {}
        local_templates.each { |lt| local_by_key[lt[:sync_key]] = lt if lt[:sync_key].present? }
        local_used_keys = Set.new

        # Start with master templates, match to local
        result = master_templates.map do |mt|
          local = mt[:sync_key].present? ? local_by_key[mt[:sync_key]] : nil
          local_used_keys.add(mt[:sync_key]) if local && mt[:sync_key].present?
          synced = mt[:sync_key].present? && local.present?
          {
            id: local&.dig(:id) || mt[:id],
            name: mt[:name],
            master_tasks: mt[:tasks],
            tasks: local&.dig(:tasks) || 0,
            synced: synced
          }
        end

        # Add local-only templates (not matched to any master template)
        local_templates.each do |lt|
          next if lt[:sync_key].present? && local_used_keys.include?(lt[:sync_key])
          # Check if name-matched to a master template already shown
          next if master_templates.any? { |mt| mt[:name].downcase.strip == lt[:name].downcase.strip }
          result << {
            id: lt[:id],
            name: lt[:name],
            master_tasks: 0,
            tasks: lt[:tasks],
            synced: false
          }
        end

        result
      end

      # Generic per-record breakdown for ConfigSyncable tables
      # Uses pluck for performance on large tables
      # Must be called within ActsAsTenant.with_tenant context
      def syncable_records_breakdown(model, master_sync_keys)
        # Find the best name column for display
        name_col = %w[name display_name item_name account_name].find { |c| model.column_names.include?(c) }
        name_col ||= "id"

        model.pluck(:id, name_col.to_sym, :sync_key).map do |id, display, sync_key|
          synced = sync_key.present? && master_sync_keys.include?(sync_key)
          { id: id, name: display.to_s, synced: synced }
        end
      end

      # PO Template Items grouped by parent pack
      # Uses PACK sync keys so status matches PO Packs row
      # Must be called within ActsAsTenant.with_tenant context
      def po_items_by_pack(master_pack_keys)
        packs = PoTemplatePack.includes(:po_template_items).all
        packs.map do |pack|
          items = pack.po_template_items
          next nil if items.empty?
          synced = pack.sync_key.present? && master_pack_keys.include?(pack.sync_key)
          { id: pack.id, name: pack.name, count: items.size, synced: synced }
        end.compact
      end

      # PO Line Items grouped by parent pack
      # Uses PACK sync keys so status matches PO Packs row
      # Must be called within ActsAsTenant.with_tenant context
      def po_lines_by_pack(master_pack_keys)
        packs = PoTemplatePack.includes(po_template_items: :po_template_line_items).all
        packs.map do |pack|
          count = pack.po_template_items.sum { |item| item.po_template_line_items.size }
          next nil if count == 0
          synced = pack.sync_key.present? && master_pack_keys.include?(pack.sync_key)
          { id: pack.id, name: pack.name, count: count, synced: synced }
        end.compact
      end

      # Claim Template Lines grouped by parent claim template
      # Uses claim template sync_keys so status matches Claim Templates row
      # Must be called within ActsAsTenant.with_tenant context
      def claim_lines_by_template(master_template_keys)
        templates = ClaimStageTemplate.includes(:lines).all
        templates.map do |tpl|
          next nil if tpl.lines.empty?
          synced = tpl.sync_key.present? && master_template_keys.include?(tpl.sync_key)
          { id: tpl.id, name: tpl.name, count: tpl.lines.size, synced: synced }
        end.compact
      end

      # Combined record breakdowns (non-master): show BOTH master + local counts per record
      # Mirrors combined_template_breakdown pattern for SM Tasks

      def combined_po_items_by_pack(master_pack_keys)
        # Master counts
        master_data = ActsAsTenant.with_tenant(master_tenant) do
          PoTemplatePack.includes(:po_template_items).all.map do |pack|
            items = pack.po_template_items
            next nil if items.empty?
            { name: pack.name, sync_key: pack.sync_key, count: items.size }
          end.compact
        end

        # Local counts (current tenant)
        local_data = PoTemplatePack.includes(:po_template_items).all.map do |pack|
          items = pack.po_template_items
          next nil if items.empty?
          synced = pack.sync_key.present? && master_pack_keys.include?(pack.sync_key)
          { id: pack.id, name: pack.name, sync_key: pack.sync_key, count: items.size, synced: synced }
        end.compact

        merge_master_local_records(master_data, local_data)
      end

      def combined_po_lines_by_pack(master_pack_keys)
        master_data = ActsAsTenant.with_tenant(master_tenant) do
          PoTemplatePack.includes(po_template_items: :po_template_line_items).all.map do |pack|
            count = pack.po_template_items.sum { |item| item.po_template_line_items.size }
            next nil if count == 0
            { name: pack.name, sync_key: pack.sync_key, count: count }
          end.compact
        end

        local_data = PoTemplatePack.includes(po_template_items: :po_template_line_items).all.map do |pack|
          count = pack.po_template_items.sum { |item| item.po_template_line_items.size }
          next nil if count == 0
          synced = pack.sync_key.present? && master_pack_keys.include?(pack.sync_key)
          { id: pack.id, name: pack.name, sync_key: pack.sync_key, count: count, synced: synced }
        end.compact

        merge_master_local_records(master_data, local_data)
      end

      def combined_claim_lines_by_template(master_template_keys)
        master_data = ActsAsTenant.with_tenant(master_tenant) do
          ClaimStageTemplate.includes(:lines).all.map do |tpl|
            next nil if tpl.lines.empty?
            { name: tpl.name, sync_key: tpl.sync_key, count: tpl.lines.size }
          end.compact
        end

        local_data = ClaimStageTemplate.includes(:lines).all.map do |tpl|
          next nil if tpl.lines.empty?
          synced = tpl.sync_key.present? && master_template_keys.include?(tpl.sync_key)
          { id: tpl.id, name: tpl.name, sync_key: tpl.sync_key, count: tpl.lines.size, synced: synced }
        end.compact

        merge_master_local_records(master_data, local_data)
      end

      def combined_syncable_records_breakdown(model, master_sync_keys)
        name_col = %w[name display_name item_name account_name].find { |c| model.column_names.include?(c) }
        name_col ||= "id"

        master_data = ActsAsTenant.with_tenant(master_tenant) do
          model.pluck(:id, name_col.to_sym, :sync_key).map do |_id, display, sync_key|
            { name: display.to_s, sync_key: sync_key }
          end
        end

        local_data = model.pluck(:id, name_col.to_sym, :sync_key).map do |id, display, sync_key|
          synced = sync_key.present? && master_sync_keys.include?(sync_key)
          { id: id, name: display.to_s, sync_key: sync_key, synced: synced }
        end

        merge_master_local_records(master_data, local_data)
      end

      # Merge master + local record lists by sync_key/name, returning combined counts
      # Returns: [{ id:, name:, master_count:, count:, synced: }]
      def merge_master_local_records(master_data, local_data)
        # Build master lookup by sync_key then name
        master_by_key = {}
        master_by_name = {}
        master_data.each do |m|
          master_by_key[m[:sync_key]] = m if m[:sync_key].present?
          master_by_name[m[:name].downcase.strip] = m
        end
        used_master_keys = Set.new

        # Start with local records, attach master counts
        result = local_data.map do |local|
          master = nil
          if local[:sync_key].present?
            master = master_by_key[local[:sync_key]]
          end
          master ||= master_by_name[local[:name].downcase.strip]

          if master
            used_master_keys.add(master[:sync_key]) if master[:sync_key].present?
            used_master_keys.add(master[:name].downcase.strip)
          end

          {
            id: local[:id],
            name: local[:name],
            master_count: master ? (master[:count] || 1) : 0,
            count: local[:count] || 1,
            synced: local[:synced]
          }
        end

        # Add master-only records not in local
        # Use negative IDs (based on index) so each entry has a unique ID.
        # id: 0 caused all master-only records to share the same React key and
        # the same tableModes key ("table:0"), triggering duplicate key warnings
        # and cascading mode changes to multiple records at once.
        master_only_index = 0
        master_data.each do |m|
          next if m[:sync_key].present? && used_master_keys.include?(m[:sync_key])
          next if used_master_keys.include?(m[:name].downcase.strip)

          master_only_index -= 1
          result << {
            id: master_only_index,
            name: m[:name],
            master_count: m[:count] || 1,
            count: 0,
            synced: false
          }
        end

        result
      end

      # Pluck match keys from a model as a Set for fast intersection
      # When remap_fks exist for match_fields, resolves FKs to logical keys
      # so that master ID 123 and local ID 456 both resolve to "pack-name"
      def pluck_match_keys(model, config)
        match_fields = config[:match_fields]
        remap_fks = config[:remap_fks] || {}
        base = scoped_model(model, config)

        # Check if any match_fields need FK remapping
        needs_remap = match_fields.any? { |f| remap_fks.key?(f) }

        if !needs_remap
          # Simple path: no FK remapping needed
          if match_fields.length == 1
            base.where.not(match_fields.first => nil)
                .pluck(match_fields.first)
                .map { |v| v.to_s.downcase.strip }
                .to_set
          else
            base.pluck(*match_fields)
                .map { |vals| Array(vals).map { |v| v.to_s.downcase.strip }.join("|") }
                .to_set
          end
        else
          # FK remap path: build lookup caches for FK → logical key
          fk_caches = {}
          match_fields.each do |field|
            next unless remap_fks.key?(field)
            fk_config = remap_fks[field]
            fk_model = fk_config[:model].constantize
            match_field = fk_config[:match_field]
            # Build id → logical_key map within current tenant context
            fk_caches[field] = fk_model.pluck(:id, match_field).to_h
          end

          base.pluck(:id, *match_fields).map do |row|
            _id = row[0]
            vals = row[1..]
            resolved = match_fields.each_with_index.map do |field, i|
              if fk_caches.key?(field)
                # Resolve FK to logical key
                (fk_caches[field][vals[i]] || "").to_s.downcase.strip
              else
                vals[i].to_s.downcase.strip
              end
            end
            resolved.join("|")
          end.to_set
        end
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
