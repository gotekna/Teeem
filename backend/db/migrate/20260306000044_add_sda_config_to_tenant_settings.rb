# frozen_string_literal: true

class AddSdaConfigToTenantSettings < ActiveRecord::Migration[7.1]
  def change
    add_column :tenant_settings, :sda_config, :jsonb, default: {}, null: false
  end
end
