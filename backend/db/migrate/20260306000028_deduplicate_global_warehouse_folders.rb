# frozen_string_literal: true

# FRC (Mar 2026): After setting all warehouse_folders to global (tenant_id=NULL),
# each tenant's copy became a duplicate. This migration deduplicates by sync_key,
# keeping the lowest ID (oldest) and reassigning warehouse_folder_document_types.
#
# Before: 597 folders (3 copies of ~200 unique folders)
# After:  ~222 unique folders
class DeduplicateGlobalWarehouseFolders < ActiveRecord::Migration[8.0]
  def up
    total_deleted = 0
    total_wfdt_reassigned = 0
    total_wfdt_deleted = 0
    total_children_reassigned = 0

    # Phase 1: Deduplicate folders WITH sync_key (575 of 597)
    dupes = exec_query(<<~SQL).rows
      SELECT sync_key, array_agg(id ORDER BY id) as ids
      FROM warehouse_folders
      WHERE sync_key IS NOT NULL AND sync_key != ''
      GROUP BY sync_key
      HAVING COUNT(*) > 1
    SQL

    dupes.each do |sync_key, ids_str|
      ids = ids_str.tr('{}', '').split(',').map(&:to_i)
      keep_id = ids.first
      delete_ids = ids[1..]

      delete_ids.each do |del_id|
        # Reassign warehouse_folder_document_types to the kept folder
        # Only if the kept folder doesn't already have that document_type
        existing_dt_ids = exec_query(
          "SELECT document_type_id FROM warehouse_folder_document_types WHERE warehouse_folder_id = $1",
          "SQL", [bind_value(keep_id)]
        ).rows.flatten

        wfdts = exec_query(
          "SELECT id, document_type_id FROM warehouse_folder_document_types WHERE warehouse_folder_id = $1",
          "SQL", [bind_value(del_id)]
        ).rows

        wfdts.each do |wfdt_id, dt_id|
          if existing_dt_ids.include?(dt_id)
            execute("DELETE FROM warehouse_folder_document_types WHERE id = #{wfdt_id}")
            total_wfdt_deleted += 1
          else
            execute("UPDATE warehouse_folder_document_types SET warehouse_folder_id = #{keep_id} WHERE id = #{wfdt_id}")
            existing_dt_ids << dt_id
            total_wfdt_reassigned += 1
          end
        end

        # Reassign children that point to this folder as parent
        children_count = exec_query(
          "SELECT COUNT(*) FROM warehouse_folders WHERE parent_id = $1",
          "SQL", [bind_value(del_id)]
        ).rows.first.first.to_i

        if children_count > 0
          execute("UPDATE warehouse_folders SET parent_id = #{keep_id} WHERE parent_id = #{del_id}")
          total_children_reassigned += children_count
        end

        # Also reassign any other FK references
        # sm_tasks.warehouse_folder_id
        execute("UPDATE sm_tasks SET warehouse_folder_id = #{keep_id} WHERE warehouse_folder_id = #{del_id}")
        # user_warehouse_folder_preferences (has warehouse_folder_ids jsonb or similar)

        # Delete the duplicate folder
        execute("DELETE FROM warehouse_folders WHERE id = #{del_id}")
        total_deleted += 1
      end
    end

    # Phase 2: Deduplicate folders WITHOUT sync_key (22 records)
    # These are library/unassigned/job folders that were created without sync
    # Group by (warehouse_type_id, name, COALESCE(parent_id, 0))
    no_key_dupes = exec_query(<<~SQL).rows
      SELECT warehouse_type_id, name, COALESCE(parent_id, 0) as pid,
             array_agg(id ORDER BY id) as ids
      FROM warehouse_folders
      WHERE sync_key IS NULL OR sync_key = ''
      GROUP BY warehouse_type_id, name, COALESCE(parent_id, 0)
      HAVING COUNT(*) > 1
    SQL

    no_key_dupes.each do |wt_id, name, pid, ids_str|
      ids = ids_str.tr('{}', '').split(',').map(&:to_i)
      keep_id = ids.first
      delete_ids = ids[1..]

      delete_ids.each do |del_id|
        existing_dt_ids = exec_query(
          "SELECT document_type_id FROM warehouse_folder_document_types WHERE warehouse_folder_id = $1",
          "SQL", [bind_value(keep_id)]
        ).rows.flatten

        wfdts = exec_query(
          "SELECT id, document_type_id FROM warehouse_folder_document_types WHERE warehouse_folder_id = $1",
          "SQL", [bind_value(del_id)]
        ).rows

        wfdts.each do |wfdt_id, dt_id|
          if existing_dt_ids.include?(dt_id)
            execute("DELETE FROM warehouse_folder_document_types WHERE id = #{wfdt_id}")
            total_wfdt_deleted += 1
          else
            execute("UPDATE warehouse_folder_document_types SET warehouse_folder_id = #{keep_id} WHERE id = #{wfdt_id}")
            existing_dt_ids << dt_id
            total_wfdt_reassigned += 1
          end
        end

        execute("UPDATE warehouse_folders SET parent_id = #{keep_id} WHERE parent_id = #{del_id}")
        execute("UPDATE sm_tasks SET warehouse_folder_id = #{keep_id} WHERE warehouse_folder_id = #{del_id}")
        execute("DELETE FROM warehouse_folders WHERE id = #{del_id}")
        total_deleted += 1
      end
    end

    say "Deleted #{total_deleted} duplicate warehouse folders"
    say "Reassigned #{total_wfdt_reassigned} warehouse_folder_document_types"
    say "Deleted #{total_wfdt_deleted} duplicate warehouse_folder_document_types"
    say "Reassigned #{total_children_reassigned} child folder parent references"
    say "Remaining folders: #{exec_query('SELECT COUNT(*) FROM warehouse_folders').rows.first.first}"
  end

  def down
    say "Cannot reverse deduplication"
  end

  private

  def bind_value(val)
    ActiveRecord::Relation::QueryAttribute.new("", val, ActiveRecord::Type::Integer.new)
  end
end
