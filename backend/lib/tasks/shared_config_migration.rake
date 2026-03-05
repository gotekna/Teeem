# frozen_string_literal: true

# Phase 2: Migrate TEEEM config records to global (shared) records.
#
# Converts TEEEM (master tenant) config records from tenant_id = <master_id>
# to tenant_id = NULL, making them visible to all tenants via
# acts_as_tenant's has_global_records: true.
#
# For each config table:
# 1. Find TEEEM master records (by sync_key match)
# 2. For each customer tenant, find their copy (matched by sync_key)
# 3. Re-point ALL FK references from customer copy → TEEEM original
# 4. Delete the customer copy
# 5. Set TEEEM original tenant_id = NULL (making it global)
#
# Usage:
#   rails shared_config:analyze              # Dry-run analysis (no changes)
#   rails shared_config:migrate              # Full migration (with confirmation)
#   rails shared_config:migrate_table[sm_trades]  # Migrate single table
#   rails shared_config:rollback             # Reverse: set global records back to master tenant

namespace :shared_config do
  desc "Analyze config tables for shared record migration (dry run, no changes)"
  task analyze: :environment do
    analyzer = SharedConfigAnalyzer.new
    analyzer.analyze_all
  end

  desc "Migrate TEEEM config records to global (tenant_id = NULL)"
  task migrate: :environment do
    migrator = SharedConfigMigrator.new
    migrator.migrate_all
  end

  desc "Migrate a single config table to global records"
  task :migrate_table, [:table_key] => :environment do |_t, args|
    table_key = args[:table_key]&.to_sym
    unless table_key
      puts "Usage: rails shared_config:migrate_table[sm_trades]"
      exit 1
    end

    migrator = SharedConfigMigrator.new
    migrator.migrate_table(table_key)
  end

  desc "Rollback: set global records back to master tenant"
  task rollback: :environment do
    migrator = SharedConfigMigrator.new
    migrator.rollback_all
  end
end

# Analyzer: dry-run analysis of what would change
class SharedConfigAnalyzer
  def initialize
    @master_tenant = Tenant.find_by(is_master_tenant: true) || Tenant.find_by(slug: "teeem")
    @customer_tenants = Tenant.where.not(id: @master_tenant.id)
    @config_tables = TenantConfigSyncService::CONFIG_TABLES
  end

  def analyze_all
    puts "=" * 80
    puts "SHARED CONFIG MIGRATION ANALYSIS (Dry Run)"
    puts "=" * 80
    puts "Master tenant: #{@master_tenant.name} (id: #{@master_tenant.id})"
    puts "Customer tenants: #{@customer_tenants.count}"
    puts ""

    total_records = 0
    total_copies = 0
    total_fk_repoints = 0

    tables_with_issues = []

    @config_tables.each do |table_key, config|
      model_class = config[:model].constantize
      next unless model_class.column_names.include?("tenant_id")

      # Count master records
      master_count = ActsAsTenant.without_tenant do
        model_class.where(tenant_id: @master_tenant.id).count
      end

      next if master_count == 0

      # Count customer copies (matched by sync_key)
      copy_count = 0
      fk_count = 0

      if model_class.column_names.include?("sync_key")
        ActsAsTenant.without_tenant do
          master_keys = model_class.where(tenant_id: @master_tenant.id).pluck(:sync_key).compact

          @customer_tenants.each do |tenant|
            copies = model_class.where(tenant_id: tenant.id, sync_key: master_keys)
            copy_count += copies.count

            # Count FK references to those copies
            copies.pluck(:id).each do |copy_id|
              fk_count += count_fk_references(model_class, copy_id)
            end
          end
        end
      end

      total_records += master_count
      total_copies += copy_count
      total_fk_repoints += fk_count

      status = copy_count > 0 ? "MIGRATE" : "GLOBAL-ONLY"
      puts format("  %-45s %6d master, %6d copies, %6d FK refs  [%s]",
                   "#{table_key} (#{config[:model]})", master_count, copy_count, fk_count, status)

      tables_with_issues << table_key if fk_count > 0
    end

    puts ""
    puts "-" * 80
    puts format("  TOTAL: %d master records, %d customer copies to delete, %d FK re-points",
                total_records, total_copies, total_fk_repoints)
    puts ""
    if tables_with_issues.any?
      puts "  Tables with FK re-pointing needed: #{tables_with_issues.join(', ')}"
    end
    puts ""
    puts "Run `rails shared_config:migrate` to execute the migration."
    puts "=" * 80
  end

  private

  # Count all FK references to a specific record across the entire schema
  def count_fk_references(model_class, record_id)
    count = 0
    find_referencing_associations(model_class).each do |assoc_info|
      ref_model = assoc_info[:model]
      fk_column = assoc_info[:foreign_key]

      begin
        count += ActsAsTenant.without_tenant do
          ref_model.unscoped.where(fk_column => record_id).count
        end
      rescue => e
        # Skip if table doesn't exist or column mismatch
      end
    end
    count
  end

  # Find all models that have a belongs_to association pointing to this model class
  def find_referencing_associations(model_class)
    @association_cache ||= {}
    return @association_cache[model_class.name] if @association_cache.key?(model_class.name)

    refs = []
    Rails.application.eager_load! unless Rails.application.config.eager_load

    ApplicationRecord.descendants.each do |ref_model|
      next if ref_model.abstract_class?
      next unless ref_model.table_exists?

      ref_model.reflect_on_all_associations(:belongs_to).each do |assoc|
        begin
          next unless assoc.klass == model_class
          fk = assoc.foreign_key.to_s
          next unless ref_model.column_names.include?(fk)
          refs << { model: ref_model, foreign_key: fk, association_name: assoc.name }
        rescue => e
          # Skip polymorphic or broken associations
        end
      end
    end

    @association_cache[model_class.name] = refs
    refs
  end
end

# Migrator: performs the actual migration
class SharedConfigMigrator
  def initialize
    @master_tenant = Tenant.find_by(is_master_tenant: true) || Tenant.find_by(slug: "teeem")
    raise "Master tenant not found!" unless @master_tenant

    @customer_tenants = Tenant.where.not(id: @master_tenant.id)
    @config_tables = TenantConfigSyncService::CONFIG_TABLES
    @log = []
    @errors = []
  end

  def migrate_all
    puts "=" * 80
    puts "SHARED CONFIG MIGRATION"
    puts "=" * 80
    puts "Master tenant: #{@master_tenant.name} (id: #{@master_tenant.id})"
    puts "Customer tenants: #{@customer_tenants.pluck(:name).join(', ')}"
    puts ""
    puts "This will:"
    puts "  1. Re-point FK references from customer copies to TEEEM originals"
    puts "  2. Delete customer copies (synced from TEEEM)"
    puts "  3. Set TEEEM records to tenant_id = NULL (global/shared)"
    puts ""
    puts "Type 'YES' to proceed:"

    confirmation = $stdin.gets&.strip
    unless confirmation == "YES"
      puts "Aborted."
      return
    end

    # Process tables in dependency order (parents before children)
    ordered_tables = dependency_ordered_tables
    puts "\nMigrating #{ordered_tables.size} tables in dependency order...\n\n"

    ordered_tables.each do |table_key|
      migrate_table(table_key)
    end

    puts "\n" + "=" * 80
    puts "MIGRATION COMPLETE"
    puts "=" * 80
    puts "  Records made global: #{@log.count { |l| l[:action] == :made_global }}"
    puts "  Customer copies deleted: #{@log.count { |l| l[:action] == :deleted_copy }}"
    puts "  FK references re-pointed: #{@log.count { |l| l[:action] == :repointed_fk }}"

    if @errors.any?
      puts "\n  ERRORS: #{@errors.size}"
      @errors.each { |e| puts "    - #{e}" }
    end

    # Write detailed log
    log_path = Rails.root.join("tmp", "shared_config_migration_#{Time.current.strftime('%Y%m%d_%H%M%S')}.log")
    File.write(log_path, @log.map(&:to_json).join("\n"))
    puts "\n  Detailed log: #{log_path}"
  end

  def migrate_table(table_key)
    config = @config_tables[table_key]
    unless config
      puts "ERROR: Unknown table key '#{table_key}'. Valid keys: #{@config_tables.keys.join(', ')}"
      return
    end

    model_class = config[:model].constantize

    # Skip tables without tenant_id (join tables like sm_schedule_master_related_pos)
    unless model_class.column_names.include?("tenant_id")
      puts "  SKIP #{table_key}: no tenant_id column (join table)"
      return
    end

    puts "  Migrating #{table_key} (#{config[:model]})..."

    ActsAsTenant.without_tenant do
      ActiveRecord::Base.transaction do
        # Step 1: Find master records
        master_records = model_class.unscoped.where(tenant_id: @master_tenant.id)
        master_count = master_records.count

        if master_count == 0
          puts "    No master records, skipping."
          return
        end

        # Step 2: For each master record, find and process customer copies
        master_records.find_each do |master_record|
          sync_key = master_record.try(:sync_key)

          if sync_key.present?
            # Find customer copies matched by sync_key
            @customer_tenants.each do |customer_tenant|
              customer_copies = model_class.unscoped
                .where(tenant_id: customer_tenant.id, sync_key: sync_key)

              customer_copies.each do |copy|
                # Step 2a: Re-point all FK references from copy → master
                repoint_fk_references(model_class, copy.id, master_record.id, customer_tenant)

                # Step 2b: Delete the customer copy
                copy.delete  # Use delete to skip callbacks/validations
                log_action(:deleted_copy, table_key, {
                  copy_id: copy.id, master_id: master_record.id,
                  tenant: customer_tenant.name, sync_key: sync_key
                })
              end
            end
          end

          # Step 3: Make master record global (tenant_id = NULL)
          master_record.update_columns(tenant_id: nil)
          log_action(:made_global, table_key, {
            record_id: master_record.id, sync_key: sync_key
          })
        end

        puts "    Done: #{master_count} records made global"
      end
    end
  rescue => e
    msg = "ERROR migrating #{table_key}: #{e.message}"
    puts "    #{msg}"
    @errors << msg
    Rails.logger.error "SharedConfigMigration: #{msg}\n#{e.backtrace.first(5).join("\n")}"
  end

  def rollback_all
    puts "ROLLBACK: Setting all global config records back to master tenant (id: #{@master_tenant.id})"
    puts "Type 'YES' to proceed:"

    confirmation = $stdin.gets&.strip
    unless confirmation == "YES"
      puts "Aborted."
      return
    end

    @config_tables.each do |table_key, config|
      model_class = config[:model].constantize
      next unless model_class.column_names.include?("tenant_id")

      ActsAsTenant.without_tenant do
        count = model_class.unscoped.where(tenant_id: nil).update_all(tenant_id: @master_tenant.id)
        puts "  #{table_key}: #{count} records restored to master tenant" if count > 0
      end
    end

    puts "Rollback complete."
  end

  private

  # Re-point all FK references from old_id to new_id across all referencing models
  def repoint_fk_references(model_class, old_id, new_id, customer_tenant)
    find_referencing_associations(model_class).each do |assoc_info|
      ref_model = assoc_info[:model]
      fk_column = assoc_info[:foreign_key]

      begin
        # Only re-point records belonging to the specific customer tenant
        scope = ref_model.unscoped.where(fk_column => old_id)

        # If the referencing model has tenant_id, scope to the customer tenant
        if ref_model.column_names.include?("tenant_id")
          scope = scope.where(tenant_id: customer_tenant.id)
        end

        count = scope.update_all(fk_column => new_id)

        if count > 0
          log_action(:repointed_fk, ref_model.table_name, {
            from_id: old_id, to_id: new_id,
            fk_column: fk_column, count: count,
            tenant: customer_tenant.name
          })
        end
      rescue => e
        @errors << "FK re-point error #{ref_model.name}.#{fk_column}: #{e.message}"
      end
    end

    # Also handle JSONB array columns that store IDs (e.g., sm_template_ids, predecessor_ids)
    repoint_jsonb_array_references(model_class, old_id, new_id, customer_tenant)
  end

  # Handle JSONB array columns that store foreign key IDs
  # These are common in SM tables (sm_template_ids, predecessor_ids, charge_*_sm_ids)
  def repoint_jsonb_array_references(model_class, old_id, new_id, customer_tenant)
    # Find config entries that reference this model via array remap_fks
    @config_tables.each do |_table_key, config|
      next unless config[:remap_fks]

      config[:remap_fks].each do |field, remap_config|
        next unless remap_config[:array] == true
        next unless remap_config[:model] == model_class.name

        ref_model = config[:model].constantize
        next unless ref_model.column_names.include?(field.to_s)

        # Find records in the customer tenant that have old_id in their array
        scope = ref_model.unscoped
        scope = scope.where(tenant_id: customer_tenant.id) if ref_model.column_names.include?("tenant_id")

        scope.find_each do |record|
          arr = record.send(field)
          next unless arr.is_a?(Array) && arr.include?(old_id)

          new_arr = arr.map { |id| id == old_id ? new_id : id }
          record.update_columns(field => new_arr)

          log_action(:repointed_jsonb_array, ref_model.table_name, {
            record_id: record.id, field: field,
            from_id: old_id, to_id: new_id,
            tenant: customer_tenant.name
          })
        end
      end
    end
  end

  # Find all models that have a belongs_to association pointing to this model class
  def find_referencing_associations(model_class)
    @association_cache ||= {}
    return @association_cache[model_class.name] if @association_cache.key?(model_class.name)

    refs = []
    Rails.application.eager_load! unless Rails.application.config.eager_load

    ApplicationRecord.descendants.each do |ref_model|
      next if ref_model.abstract_class?
      begin
        next unless ref_model.table_exists?
      rescue => e
        next
      end

      ref_model.reflect_on_all_associations(:belongs_to).each do |assoc|
        begin
          next unless assoc.klass == model_class
          fk = assoc.foreign_key.to_s
          next unless ref_model.column_names.include?(fk)
          refs << { model: ref_model, foreign_key: fk, association_name: assoc.name }
        rescue => e
          # Skip polymorphic or broken associations
        end
      end
    end

    @association_cache[model_class.name] = refs
    refs
  end

  # Process tables in dependency order (parents before children)
  # Tables with remap_fks depend on the tables they reference
  def dependency_ordered_tables
    # Build dependency graph from remap_fks
    deps = {}
    table_by_model = {}

    @config_tables.each do |key, config|
      table_by_model[config[:model]] = key
      deps[key] = []
    end

    @config_tables.each do |key, config|
      next unless config[:remap_fks]
      config[:remap_fks].each do |_field, remap|
        dep_key = table_by_model[remap[:model]]
        deps[key] << dep_key if dep_key && dep_key != key  # skip self-references
      end
    end

    # Topological sort (Kahn's algorithm)
    in_degree = {}
    deps.each { |k, _| in_degree[k] = 0 }
    deps.each { |_k, v| v.each { |d| in_degree[d] = (in_degree[d] || 0) + 1 } }

    # Actually reverse: parents should come first
    # Re-calculate: in_degree counts how many things depend ON this table
    in_degree = {}
    deps.each { |k, _| in_degree[k] = 0 }
    deps.each { |_k, v| v.each { |d| in_degree[d] ||= 0 } }
    deps.each do |k, v|
      in_degree[k] ||= 0
      v.each { |_d| in_degree[k] += 1 }
    end

    queue = deps.keys.select { |k| in_degree[k] == 0 }
    sorted = []

    while queue.any?
      node = queue.shift
      sorted << node

      # Find tables that depend on this node and decrement their in-degree
      deps.each do |k, v|
        if v.include?(node)
          in_degree[k] -= 1
          queue << k if in_degree[k] == 0
        end
      end
    end

    # Add any remaining (cycles) at the end
    remaining = deps.keys - sorted
    sorted + remaining
  end

  def log_action(action, table, details = {})
    entry = { action: action, table: table, timestamp: Time.current.iso8601 }.merge(details)
    @log << entry
  end
end
