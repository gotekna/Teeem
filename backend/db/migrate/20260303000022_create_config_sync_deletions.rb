# frozen_string_literal: true

# Tombstone table for config sync deletions.
#
# When a ConfigSyncable record is destroyed (in any tenant), an after_destroy callback
# writes a tombstone here. The cascade sync button reads pending tombstones and propagates
# the deletion to TEEEM master and all other tenants, then marks them as propagated.
#
# Without this, cascade sync would re-import deleted records (TEEEM still has them).
class CreateConfigSyncDeletions < ActiveRecord::Migration[7.1]
  def change
    create_table :config_sync_deletions do |t|
      t.integer  :tenant_id,     null: false
      t.string   :model_type,    null: false
      t.string   :sync_key,      null: false
      t.datetime :deleted_at,    null: false
      t.datetime :propagated_at  # nil = not yet propagated

      t.timestamps
    end

    add_index :config_sync_deletions, [:tenant_id, :model_type, :sync_key],
              name: "idx_config_sync_deletions_lookup"
    add_index :config_sync_deletions, [:propagated_at],
              name: "idx_config_sync_deletions_pending",
              where: "propagated_at IS NULL"
  end
end
