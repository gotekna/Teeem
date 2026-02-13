# frozen_string_literal: true

class AddLastConfigSyncToTenantSettings < ActiveRecord::Migration[7.1]
  def change
    add_column :tenant_settings, :last_config_sync_at, :datetime
    add_column :tenant_settings, :last_config_sync_by, :string
  end
end
