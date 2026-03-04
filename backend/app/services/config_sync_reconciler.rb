# frozen_string_literal: true

# ConfigSyncReconciler — Post-sync verification and repair tool
#
# Compares config records across all tenants (TEEEM + customers) and detects:
# - Missing sync_keys (records invisible to matching)
# - Missing records (in one tenant but not another)
# - Extra records (orphans that should have been cleaned up)
# - Field-level diffs (same sync_key, different field values)
# - Duplicate sync_keys (constraint violations waiting to happen)
#
# TEEEM is SSoT. After fix, all customer tenants match TEEEM exactly.
#
# Usage:
#   reconciler = ConfigSyncReconciler.new
#   reconciler.verify("sm_schedule_masters")  # Quick pass/fail
#   reconciler.report("sm_schedule_masters")  # Detailed diffs
#   reconciler.fix("sm_schedule_masters")     # Auto-repair
#   reconciler.fix("all")                     # Fix everything
#
class ConfigSyncReconciler
  CONFIG_TABLES = TenantConfigSyncService::CONFIG_TABLES

  # Tables processed in dependency order (parents before children).
  # Derived from CONFIG_TABLES remap_fks — ensures FK targets exist before FK sources.
  DEPENDENCY_ORDER = begin
    deps = TenantConfigSyncService.table_dependencies
    all_keys = CONFIG_TABLES.keys.map(&:to_s)

    # Topological sort: tables with no dependencies first
    sorted = []
    remaining = all_keys.dup
    loop do
      batch = remaining.select { |k| (deps[k] || []).all? { |d| sorted.include?(d) } }
      break if batch.empty?
      sorted.concat(batch.sort) # alphabetical within each tier
      remaining -= batch
    end
    sorted.concat(remaining.sort) # any cycles go at the end
    sorted.freeze
  end

  def initialize
    @master = Tenant.find_by(is_master_tenant: true) || Tenant.find_by(slug: "teeem")
    @customers = Tenant.where(is_master_tenant: false).to_a
    @all_tenants = [@master, *@customers].compact
  end

  # ============================================================================
  # VERIFY — Quick pass/fail per table
  # ============================================================================
  # Returns: { pass: bool, tables: { "table_key" => { status, counts, issues } } }
  def verify(table_key = "all")
    tables = resolve_tables(table_key)
    results = {}

    tables.each do |key|
      config = CONFIG_TABLES[key.to_sym]
      next unless config
      model = config[:model].constantize
      has_sync_key = model.column_names.include?("sync_key")

      tenant_data = {}
      @all_tenants.each do |t|
        ActsAsTenant.with_tenant(t) do
          records = syncable_records(model, config, key)
          sync_keys = has_sync_key ? records.where.not(sync_key: [nil, ""]).pluck(:sync_key) : []
          missing_keys = has_sync_key ? records.where(sync_key: [nil, ""]).count : 0
          duplicate_keys = has_sync_key ? sync_keys.tally.select { |_, c| c > 1 } : {}

          tenant_data[t.name] = {
            count: records.count,
            sync_keys: sync_keys.sort,
            missing_sync_keys: missing_keys,
            duplicate_sync_keys: duplicate_keys
          }
        end
      end

      # Compare all customers against master
      master_data = tenant_data[@master.name]
      master_keys = Set.new(master_data[:sync_keys])
      issues = []

      @customers.each do |t|
        td = tenant_data[t.name]
        customer_keys = Set.new(td[:sync_keys])

        missing = (master_keys - customer_keys).to_a.sort
        extra = (customer_keys - master_keys).to_a.sort

        issues << "#{t.name}: #{missing.size} missing" if missing.any?
        issues << "#{t.name}: #{extra.size} extra" if extra.any?
        issues << "#{t.name}: #{td[:missing_sync_keys]} records without sync_key" if td[:missing_sync_keys] > 0
        issues << "#{t.name}: #{td[:duplicate_sync_keys].size} duplicate sync_keys" if td[:duplicate_sync_keys].any?
      end

      # Also check master itself
      if master_data[:missing_sync_keys] > 0
        issues << "#{@master.name}: #{master_data[:missing_sync_keys]} records without sync_key"
      end
      if master_data[:duplicate_sync_keys].any?
        issues << "#{@master.name}: #{master_data[:duplicate_sync_keys].size} duplicate sync_keys"
      end

      status = issues.empty? ? "pass" : "fail"
      results[key] = {
        status: status,
        counts: tenant_data.transform_values { |v| v[:count] },
        issues: issues.presence
      }.compact
    end

    { pass: results.values.all? { |r| r[:status] == "pass" }, tables: results }
  end

  # ============================================================================
  # REPORT — Detailed per-record comparison
  # ============================================================================
  # Returns: { tables: { "table_key" => { status, master_count, tenants: { ... } } } }
  def report(table_key = "all")
    tables = resolve_tables(table_key)
    results = {}

    tables.each do |key|
      config = CONFIG_TABLES[key.to_sym]
      next unless config
      model = config[:model].constantize
      has_sync_key = model.column_names.include?("sync_key")

      # Load master records (only syncable — e.g. "Teeem" templates only)
      master_records = ActsAsTenant.with_tenant(@master) { syncable_records(model, config, key).to_a }
      master_by_key = {}
      master_no_key = []
      if has_sync_key
        master_records.each do |r|
          if r.sync_key.present?
            master_by_key[r.sync_key] = r
          else
            master_no_key << r
          end
        end
      end

      tenant_reports = {}
      @customers.each do |t|
        customer_records = ActsAsTenant.with_tenant(t) { syncable_records(model, config, key).to_a }

        customer_by_key = {}
        customer_no_key = []
        if has_sync_key
          customer_records.each do |r|
            if r.sync_key.present?
              customer_by_key[r.sync_key] = r
            else
              customer_no_key << r
            end
          end
        end

        # Missing: in master, not in customer
        missing_keys = (master_by_key.keys - customer_by_key.keys).sort
        missing = missing_keys.map { |sk| { sync_key: sk, name: record_display_name(master_by_key[sk], config) } }

        # Extra: in customer, not in master
        extra_keys = (customer_by_key.keys - master_by_key.keys).sort
        extra = extra_keys.map { |sk| { sync_key: sk, name: record_display_name(customer_by_key[sk], config) } }

        # Diffs: same sync_key, different field values
        common_keys = (master_by_key.keys & customer_by_key.keys).sort
        diffs = []
        common_keys.each do |sk|
          mr = master_by_key[sk]
          cr = customer_by_key[sk]
          field_diffs = compare_sync_fields(mr, cr, config)
          if field_diffs.any?
            diffs << {
              sync_key: sk,
              name: record_display_name(mr, config),
              fields: field_diffs
            }
          end
        end

        # Duplicate sync_keys in customer
        duplicates = customer_records
          .select { |r| r.respond_to?(:sync_key) && r.sync_key.present? }
          .group_by(&:sync_key)
          .select { |_, recs| recs.size > 1 }
          .map { |sk, recs| { sync_key: sk, count: recs.size, ids: recs.map(&:id) } }

        tenant_reports[t.name] = {
          count: customer_records.size,
          missing: missing.presence,
          extra: extra.presence,
          diffs: diffs.presence,
          no_sync_key: customer_no_key.size > 0 ? customer_no_key.size : nil,
          duplicates: duplicates.presence
        }.compact
      end

      all_match = tenant_reports.values.all? { |r| r.keys == [:count] }
      results[key] = {
        status: all_match ? "pass" : "fail",
        master_count: master_records.size,
        master_no_sync_key: master_no_key.size > 0 ? master_no_key.size : nil,
        tenants: tenant_reports
      }.compact
    end

    { tables: results }
  end

  # ============================================================================
  # FIX — Automated repair (TEEEM is SSoT)
  # ============================================================================
  # Phases:
  #   0. Backfill missing sync_keys (all tenants)
  #   1. Delete duplicates (keep the one with sync_key or most recent)
  #   2. Pull customers → TEEEM (aggregate changes)
  #   3. Push TEEEM → customers (make identical)
  #   4. Delete extras in customers (orphan cleanup)
  #   5. Verify (confirm pass)
  #
  # Returns: { phases: { ... }, verification: { ... } }
  def fix(table_key = "all")
    tables = resolve_tables(table_key)
    phase_results = {}

    tables.each do |key|
      config = CONFIG_TABLES[key.to_sym]
      next unless config
      model = config[:model].constantize
      has_sync_key = model.column_names.include?("sync_key")

      table_phases = {}

      # ── Phase 0: Backfill missing sync_keys ────────────────────────────
      if has_sync_key
        backfill_results = {}
        @all_tenants.each do |t|
          count = backfill_sync_keys(t, key, model, config)
          backfill_results[t.name] = count if count > 0
        end
        table_phases[:backfill_sync_keys] = backfill_results if backfill_results.any?
      end

      # ── Phase 1: Delete duplicates ─────────────────────────────────────
      if has_sync_key
        dedup_results = {}
        @all_tenants.each do |t|
          count = delete_duplicate_sync_keys(t, key, model, config)
          dedup_results[t.name] = count if count > 0
        end
        table_phases[:delete_duplicates] = dedup_results if dedup_results.any?
      end

      # ── Phase 2: Pull customers → TEEEM ────────────────────────────────
      pull_results = {}
      master_svc = TenantConfigSyncService.new(@master)
      @customers.each do |t|
        source_ids = ActsAsTenant.with_tenant(t) { syncable_records(model, config, key).pluck(:id) }
        next if source_ids.empty?

        result = master_svc.import_from_tenant(
          source_tenant: t, table: key.to_s, record_ids: source_ids
        )
        imported_count = result[:imported]&.length || 0
        pull_results[t.name] = imported_count if imported_count > 0
      end
      table_phases[:pull_to_master] = pull_results if pull_results.any?

      # ── Phase 3: Push TEEEM → customers ────────────────────────────────
      master_ids = ActsAsTenant.with_tenant(@master) { syncable_records(model, config, key).pluck(:id) }
      push_results = {}
      @customers.each do |t|
        next if master_ids.empty?
        svc = TenantConfigSyncService.new(t)
        result = svc.pull_from_master(
          table: key.to_s, record_ids: master_ids, mode: :replace_existing
        )
        imported = result[:imported]&.length || 0
        updated = result[:updated]&.length || 0
        push_results[t.name] = { imported: imported, updated: updated } if imported > 0 || updated > 0
      end
      table_phases[:push_to_customers] = push_results if push_results.any?

      # ── Phase 4: Delete extras in customers ────────────────────────────
      if has_sync_key
        delete_results = {}
        @customers.each do |t|
          svc = TenantConfigSyncService.new(t)
          result = svc.delete_orphaned_from_master(table: key.to_sym)
          deleted = result[:deleted] || 0
          delete_results[t.name] = deleted if deleted > 0
        end
        table_phases[:delete_extras] = delete_results if delete_results.any?
      end

      phase_results[key] = table_phases if table_phases.any?
    end

    # ── Phase 5: Verify ────────────────────────────────────────────────
    verification = verify(table_key)

    { phases: phase_results, verification: verification }
  end

  private

  # Resolve "all" to the full dependency-ordered list, or return a single table
  def resolve_tables(table_key)
    if table_key == "all"
      DEPENDENCY_ORDER
    else
      raise ArgumentError, "Unknown table: #{table_key}" unless CONFIG_TABLES.key?(table_key.to_sym)
      [table_key.to_s]
    end
  end

  # Apply scope filter if configured
  def scoped_records(model, config)
    config[:scope] ? model.instance_exec(&config[:scope]) : model.all
  end

  # Returns only records that should be synced for this table.
  # For SM tables: only templates starting with "Teeem" and their child tasks.
  # Non-Teeem templates are tenant-specific (independent) and invisible to reconciliation.
  def syncable_records(model, config, table_key)
    base = scoped_records(model, config)

    case table_key.to_s
    when "sm_schedule_master_templates"
      base.where("name ILIKE ?", "Teeem%")
    when "sm_schedule_masters"
      # sm_schedule_masters uses sm_template_ids JSONB array, NOT a FK column
      teeem_tmpl_ids = SmScheduleMasterTemplate.where("name ILIKE ?", "Teeem%").pluck(:id)
      if teeem_tmpl_ids.any?
        conditions = teeem_tmpl_ids.map { |id| "sm_template_ids @> '[#{id.to_i}]'::jsonb" }
        base.where(conditions.join(" OR "))
      else
        base.none
      end
    else
      base
    end
  end

  # Human-readable name for a record
  def record_display_name(record, config)
    field = config[:name_field]
    record.respond_to?(field) ? record.send(field).to_s : "##{record.id}"
  end

  # Compare sync_fields between two records, returning only fields that differ.
  # FK fields are normalized to their match_field value (e.g. trade_id=5 → "Plumbing")
  # so that the same logical value with different IDs is not flagged as a diff.
  def compare_sync_fields(master_record, customer_record, config)
    diffs = []
    config[:sync_fields].each do |field|
      next unless master_record.respond_to?(field) && customer_record.respond_to?(field)

      master_val = master_record.send(field)
      customer_val = customer_record.send(field)

      # FK normalization: resolve both values to their match_field names
      if config[:remap_fks]&.key?(field) && (master_val.present? || customer_val.present?)
        remap = config[:remap_fks][field]
        if remap[:array]
          # Array FK: normalize each element
          master_val = normalize_fk_array(master_val, remap)
          customer_val = normalize_fk_array(customer_val, remap)
        elsif remap[:format] == :po_allocations
          # Skip detailed comparison for complex nested hashes — just compare keys
          master_val = master_val.is_a?(Hash) ? master_val.keys.sort : master_val
          customer_val = customer_val.is_a?(Hash) ? customer_val.keys.sort : customer_val
        else
          # Single FK: resolve to name
          master_val = resolve_fk_name(master_val, remap)
          customer_val = resolve_fk_name(customer_val, remap)
        end
      end

      unless values_match?(master_val, customer_val)
        diffs << {
          field: field.to_s,
          master: summarize_value(master_val),
          customer: summarize_value(customer_val)
        }
      end
    end
    diffs
  end

  # Compare two values with normalization (nil/blank equivalence, array sorting, etc.)
  def values_match?(a, b)
    a = normalize_for_compare(a)
    b = normalize_for_compare(b)
    a == b
  end

  def normalize_for_compare(val)
    case val
    when nil then nil
    when String then val.blank? ? nil : val.strip
    when Array then val.compact.sort
    when Hash then val.sort.to_h
    when BigDecimal, Float then val.to_f.round(6)
    else val
    end
  end

  # Truncate long values for display
  def summarize_value(val)
    s = val.to_s
    s.length > 100 ? "#{s[0..97]}..." : s
  end

  # Resolve a single FK ID to its match_field name (e.g. trade_id=5 → "Plumbing")
  def resolve_fk_name(id, remap_config)
    return nil if id.blank?
    target_model = remap_config[:model].constantize
    match_field = remap_config[:match_field]
    record = ActsAsTenant.without_tenant { target_model.find_by(id: id) }
    record&.send(match_field)
  end

  # Normalize an array of FK IDs to their match_field names
  def normalize_fk_array(arr, remap_config)
    return [] unless arr.is_a?(Array)
    arr.filter_map do |element|
      id = element.is_a?(Hash) ? (element["id"] || element[:id]) : element
      resolve_fk_name(id, remap_config)
    end.sort
  end

  # ── Phase 0: Backfill sync_keys ──────────────────────────────────────
  # For records missing sync_key, generate one using the model's sync_key_source.
  def backfill_sync_keys(tenant, table_key, model, config)
    count = 0
    ActsAsTenant.with_tenant(tenant) do
      records = syncable_records(model, config, table_key).where(sync_key: [nil, ""])
      records.find_each do |record|
        new_key = generate_sync_key(record, model)
        next if new_key.blank?

        # Skip if another record in this tenant already has this sync_key
        existing = model.where(sync_key: new_key).where.not(id: record.id).exists?
        next if existing

        record.update_column(:sync_key, new_key)
        count += 1
      end
    end
    count
  end

  # Generate a sync_key for a record using the model's sync_key_source convention
  def generate_sync_key(record, model)
    if model.respond_to?(:sync_key_source)
      sources = Array(model.sync_key_source)
      values = sources.map { |f| record.send(f).to_s.strip }.reject(&:blank?)
      return nil if values.empty?
      model.respond_to?(:build_sync_key) ? model.build_sync_key(*values) : values.join("|").downcase
    elsif record.respond_to?(:name) && record.name.present?
      record.name.to_s.strip.downcase
    else
      nil
    end
  end

  # ── Phase 1: Delete duplicates ───────────────────────────────────────
  # When multiple records share the same sync_key, keep the most recently updated one.
  def delete_duplicate_sync_keys(tenant, table_key, model, config)
    count = 0
    ActsAsTenant.with_tenant(tenant) do
      dupes = syncable_records(model, config, table_key)
        .where.not(sync_key: [nil, ""])
        .group(:sync_key)
        .having("COUNT(*) > 1")
        .pluck(:sync_key)

      dupes.each do |sync_key|
        records = model.where(sync_key: sync_key).order(updated_at: :desc).to_a
        keeper = records.first # most recently updated
        records[1..].each do |dup_record|
          dup_record.destroy
          count += 1
        rescue => e
          Rails.logger.warn "[ConfigSyncReconciler] Could not delete duplicate #{model}##{dup_record.id}: #{e.message[0..100]}"
        end
      end
    end
    count
  end
end
