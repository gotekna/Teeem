# frozen_string_literal: true

class AddEnabledModulesToTenantSettings < ActiveRecord::Migration[7.1]
  def change
    add_column :tenant_settings, :enabled_modules, :jsonb, default: {}, null: false
  end
end
