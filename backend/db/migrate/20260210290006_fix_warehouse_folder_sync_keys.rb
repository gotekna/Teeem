# frozen_string_literal: true

# Fix: Regenerate warehouse_folder sync_keys using warehouse_type_code
#
# The sync_key_source was [:warehouse_type, :tab_key] which used the association
# object (returning "#<WarehouseType:0x...>") instead of the code string.
# This made all sync_keys garbage, breaking config sync matching.
#
# Now uses [:warehouse_type_code, :tab_key] which produces proper keys like
# "job--overview" or "corporate--info".
class FixWarehouseFolderSyncKeys < ActiveRecord::Migration[8.0]
  def up
    # Regenerate all warehouse_folder sync_keys across all tenants
    total = 0
    WarehouseFolder.unscoped.includes(:warehouse_type).find_each do |folder|
      next unless folder.warehouse_type

      new_key = WarehouseFolder.build_sync_key(
        folder.warehouse_type.code.to_s,
        folder.tab_key.to_s
      )

      if folder.sync_key != new_key
        folder.update_column(:sync_key, new_key)
        total += 1
      end
    end

    puts "[FixWarehouseFolderSyncKeys] Regenerated #{total} sync_keys"
  end

  def down
    # No-op: can't restore old garbage sync_keys
  end
end
