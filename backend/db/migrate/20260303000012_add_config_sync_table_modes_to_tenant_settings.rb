# frozen_string_literal: true

# Stores per-table sync direction preference per tenant.
# Values: "two_way", "one_way", "independent"
# Example: { "sm_trades" => "two_way", "quote_templates" => "independent" }
#
class AddConfigSyncTableModesToTenantSettings < ActiveRecord::Migration[7.2]
  def change
    add_column :tenant_settings, :config_sync_table_modes, :jsonb, default: {}, if_not_exists: true
  end
end
