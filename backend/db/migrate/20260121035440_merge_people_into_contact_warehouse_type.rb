# frozen_string_literal: true

# Phase 1: Contact Consolidation - Merge "people" into "contact"
#
# SSoT: Contact is THE ONE table for all individuals (customers, suppliers, employees, users)
#
# What this migration does:
# 1. EntityTab.warehouse_type: 'people' → 'contact'
# 2. DocumentType.scope: 'people' → 'contacts'
# 3. StorageConfiguration.warehouse_root_folders: 'people' → 'contact'
#
# Safety: This is a data migration only - no schema changes.
# Reversible: Can be rolled back if needed.
#
class MergePeopleIntoContactWarehouseType < ActiveRecord::Migration[8.0]
  def up
    # 1. Update EntityTabs warehouse_type from 'people' to 'contact'
    execute <<-SQL.squish
      UPDATE entity_tabs
      SET warehouse_type = 'contact',
          updated_at = NOW()
      WHERE warehouse_type = 'people'
    SQL
    say "Updated #{EntityTab.where(warehouse_type: 'contact').count} EntityTabs"

    # 2. Update DocumentTypes scope from 'people' to 'contacts'
    # Note: 'contacts' (plural) is the canonical scope value for Contact-linked document types
    execute <<-SQL.squish
      UPDATE document_types
      SET scope = 'contacts',
          updated_at = NOW()
      WHERE scope = 'people'
    SQL
    say "Updated DocumentType scopes"

    # 3. Update StorageConfiguration warehouse_root_folders
    # Migrate 'people' key to 'contact' key in JSONB column
    execute <<-SQL.squish
      UPDATE storage_configurations
      SET warehouse_root_folders = warehouse_root_folders - 'people' || jsonb_build_object('contact', warehouse_root_folders->'people'),
          updated_at = NOW()
      WHERE warehouse_root_folders ? 'people'
    SQL
    say "Updated StorageConfiguration warehouse_root_folders"

    say "Phase 1 Complete: 'people' merged into 'contact'"
  end

  def down
    # Reverse: Update EntityTabs back to 'people'
    # Note: This is a best-effort rollback - only affects tabs that were originally 'people'
    # Since we can't distinguish which 'contact' tabs were originally 'people',
    # we rollback based on the seed data pattern (overview tab for people)
    execute <<-SQL.squish
      UPDATE entity_tabs
      SET warehouse_type = 'people',
          updated_at = NOW()
      WHERE warehouse_type = 'contact'
      AND tab_key = 'overview'
      AND tab_group = 'overview'
    SQL

    # Reverse: DocumentTypes - there's no reliable way to know which were 'people' originally
    # so we don't rollback this change (safe because 'contacts' is the correct canonical value)

    # Reverse: StorageConfiguration - restore 'people' key
    execute <<-SQL.squish
      UPDATE storage_configurations
      SET warehouse_root_folders = warehouse_root_folders - 'contact' || jsonb_build_object('people', warehouse_root_folders->'contact'),
          updated_at = NOW()
      WHERE warehouse_root_folders ? 'contact'
      AND NOT warehouse_root_folders ? 'people'
    SQL

    say "Rollback complete - 'contact' restored to 'people' where possible"
  end
end
