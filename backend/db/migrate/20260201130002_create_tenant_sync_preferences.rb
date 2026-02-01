# frozen_string_literal: true

# Stores sync preferences for config records when creating new tenants
#
# sync_mode options:
# - 'compulsory': Record is automatically synced when new tenant is created
# - 'choice': Record is shown as optional during tenant creation
# - null: Record is not offered during tenant creation
#
# These preferences are only set by the master tenant (TEEEM)
class CreateTenantSyncPreferences < ActiveRecord::Migration[8.0]
  def change
    create_table :tenant_sync_preferences do |t|
      t.references :tenant, null: false, foreign_key: true
      t.string :configurable_type, null: false
      t.bigint :configurable_id, null: false
      t.string :sync_mode # 'compulsory', 'choice', or null

      t.timestamps
    end

    # Unique constraint: one preference per record per tenant
    add_index :tenant_sync_preferences,
              [:tenant_id, :configurable_type, :configurable_id],
              unique: true,
              name: 'idx_sync_prefs_unique_record'

    # Index for querying by type and mode
    add_index :tenant_sync_preferences,
              [:configurable_type, :sync_mode],
              name: 'idx_sync_prefs_type_mode'
  end
end
