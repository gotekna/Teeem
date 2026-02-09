# frozen_string_literal: true

# FRC (Feb 2026): User documents uploaded via My Docs are stored in Blobs/ (virtual),
# not in physical S3 folders like "Teeem Docs/Robert Harder/". The warehouse tree
# tried to list S3 folders → found nothing → "No files in this folder".
#
# Fix: Mark "user" warehouse type as virtual so the tree queries WarehouseDocument
# records from the database instead of listing S3 folders.
class MarkUserWarehouseAsVirtual < ActiveRecord::Migration[7.2]
  def up
    # Update all WarehouseProvider records to include "user" in virtual_warehouses
    execute(<<-SQL.squish)
      UPDATE warehouse_providers
      SET virtual_warehouses = COALESCE(virtual_warehouses, '{}'::jsonb) || '{"user": true}'::jsonb
      WHERE NOT (COALESCE(virtual_warehouses, '{}'::jsonb) ? 'user'
                 AND (virtual_warehouses->>'user')::boolean = true)
    SQL
  end

  def down
    execute(<<-SQL.squish)
      UPDATE warehouse_providers
      SET virtual_warehouses = virtual_warehouses - 'user'
      WHERE virtual_warehouses ? 'user'
    SQL
  end
end
