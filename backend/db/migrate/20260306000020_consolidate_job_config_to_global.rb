# frozen_string_literal: true

# Consolidate all tenant-specific job config records into global records.
# Tables: job_statuses, job_stages, job_types, job_tabs
# Join tables: job_type_statuses, job_status_stages
#
# For each unique name, the record with the lowest ID becomes the global
# record (tenant_id = NULL). All FK references are remapped, duplicates
# in join tables are deduped, and loser records are deleted.
class ConsolidateJobConfigToGlobal < ActiveRecord::Migration[8.0]
  def up
    # ======================================================================
    # Phase 1: Build ID remap tables  { old_id => winner_id }
    # Winner = lowest ID for each unique name (or slug for tabs)
    # ======================================================================
    status_remap = build_remap("job_statuses", "name")
    stage_remap  = build_remap("job_stages", "name")
    type_remap   = build_remap("job_types", "name")
    tab_remap    = build_remap("job_tabs", "slug")

    say "Status remap: #{status_remap.size} losers → winners"
    say "Stage remap: #{stage_remap.size} losers → winners"
    say "Type remap: #{type_remap.size} losers → winners"
    say "Tab remap: #{tab_remap.size} losers → winners"

    # ======================================================================
    # Phase 2: Drop unique indexes on join tables (will re-add after dedup)
    # ======================================================================
    remove_index :job_type_statuses, name: "index_job_type_statuses_on_job_type_id_and_job_status_id", if_exists: true
    remove_index :job_status_stages, name: "index_job_status_stages_on_type_status_stage", if_exists: true

    # ======================================================================
    # Phase 3: Remap all FK references
    # ======================================================================

    # jobs table
    remap_fk("jobs", "job_status_id", status_remap)
    remap_fk("jobs", "job_stage_id", stage_remap)
    remap_fk("jobs", "job_type_id", type_remap)

    # job_stages.job_status_id
    remap_fk("job_stages", "job_status_id", status_remap)

    # tenant_settings defaults
    remap_fk("tenant_settings", "default_job_status_id", status_remap)
    remap_fk("tenant_settings", "default_job_stage_id", stage_remap)

    # colour_selection_templates.job_type_id
    remap_fk("colour_selection_templates", "job_type_id", type_remap)

    # specification_templates.job_type_id (currently all NULL, but be safe)
    remap_fk("specification_templates", "job_type_id", type_remap)

    # Join tables: remap composite FKs
    remap_fk("job_type_statuses", "job_type_id", type_remap)
    remap_fk("job_type_statuses", "job_status_id", status_remap)
    remap_fk("job_status_stages", "job_type_id", type_remap)
    remap_fk("job_status_stages", "job_status_id", status_remap)
    remap_fk("job_status_stages", "job_stage_id", stage_remap)

    # ======================================================================
    # Phase 4: Dedup join tables (keep lowest ID per unique key)
    # ======================================================================
    dedup_join_table("job_type_statuses", ["job_type_id", "job_status_id"])
    dedup_join_table("job_status_stages", ["job_type_id", "job_status_id", "job_stage_id"])

    # ======================================================================
    # Phase 5: Delete loser records from primary tables
    # ======================================================================
    delete_losers("job_type_statuses", tab_remap)  # join table losers already handled by dedup
    delete_losers("job_status_stages", tab_remap)  # join table losers already handled by dedup
    delete_losers("job_statuses", status_remap)
    delete_losers("job_stages", stage_remap)
    delete_losers("job_types", type_remap)
    delete_losers("job_tabs", tab_remap)

    # ======================================================================
    # Phase 6: Set all remaining records to global (tenant_id = NULL)
    # ======================================================================
    %w[job_statuses job_stages job_types job_tabs job_type_statuses job_status_stages].each do |table|
      execute("UPDATE #{table} SET tenant_id = NULL WHERE tenant_id IS NOT NULL")
      say "Set #{table} to global"
    end

    # ======================================================================
    # Phase 7: Re-add unique indexes
    # ======================================================================
    add_index :job_type_statuses, [:job_type_id, :job_status_id],
              name: "index_job_type_statuses_on_job_type_id_and_job_status_id", unique: true
    add_index :job_status_stages, [:job_type_id, :job_status_id, :job_stage_id],
              name: "index_job_status_stages_on_type_status_stage", unique: true

    # ======================================================================
    # Phase 8: Clear sync_key fields (no longer needed for global records)
    # ======================================================================
    %w[job_statuses job_stages job_types job_tabs job_type_statuses job_status_stages].each do |table|
      if column_exists?(table.to_sym, :sync_key)
        execute("UPDATE #{table} SET sync_key = NULL")
      end
    end
  end

  def down
    raise ActiveRecord::IrreversibleMigration,
          "Cannot reverse global consolidation. Restore from backup if needed."
  end

  private

  # Build { old_id => winner_id } map. Winner = lowest ID per unique key_field value.
  # Only includes entries where old_id != winner_id (i.e., losers only).
  def build_remap(table, key_field)
    rows = execute("SELECT id, #{key_field} FROM #{table} ORDER BY id")
    groups = rows.group_by { |r| r[key_field] }
    remap = {}

    groups.each do |_key, records|
      winner_id = records.first["id"]
      records[1..].each { |r| remap[r["id"]] = winner_id }
    end

    remap
  end

  # Update a single FK column using the remap
  def remap_fk(table, column, remap)
    return if remap.empty?

    # Build a CASE expression for efficient batch update
    case_clauses = remap.map { |old_id, new_id| "WHEN #{old_id} THEN #{new_id}" }.join(" ")
    old_ids = remap.keys.join(",")

    count = execute(
      "UPDATE #{table} SET #{column} = CASE #{column} #{case_clauses} END " \
      "WHERE #{column} IN (#{old_ids})"
    ).cmd_tuples

    say "  Remapped #{count} rows in #{table}.#{column}" if count > 0
  end

  # Remove duplicate rows from join table, keeping the row with the lowest ID
  # for each unique combination of key_columns.
  def dedup_join_table(table, key_columns)
    key_list = key_columns.join(", ")

    count = execute(<<~SQL).cmd_tuples
      DELETE FROM #{table}
      WHERE id NOT IN (
        SELECT MIN(id)
        FROM #{table}
        GROUP BY #{key_list}
      )
    SQL

    say "  Deduped #{table}: removed #{count} duplicate rows"
  end

  # Delete loser records (those whose IDs are in the remap keys)
  def delete_losers(table, remap)
    loser_ids = remap.keys
    return if loser_ids.empty?

    count = execute("DELETE FROM #{table} WHERE id IN (#{loser_ids.join(",")})").cmd_tuples
    say "  Deleted #{count} loser records from #{table}"
  end
end
