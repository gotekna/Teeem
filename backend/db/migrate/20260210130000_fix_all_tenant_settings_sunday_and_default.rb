# frozen_string_literal: true

# Fix: Previous migration (20260209200004) used TenantSetting.find_each which was
# scoped by acts_as_tenant, so only fixed tenant_id=3 (the first/fallback).
# Tenant_id=2 and tenant_id=1 still had sunday=true.
#
# Also fixes the column DEFAULT so new records get sunday=false.
class FixAllTenantSettingsSundayAndDefault < ActiveRecord::Migration[7.2]
  def up
    # Fix ALL existing records (unscoped to bypass acts_as_tenant)
    execute <<~SQL
      UPDATE tenant_settings
      SET working_days = jsonb_set(working_days, '{sunday}', 'false')
      WHERE working_days->>'sunday' = 'true'
    SQL

    # Fix column default so new records also get sunday=false
    new_default = '{"friday": true, "monday": true, "sunday": false, "tuesday": true, "saturday": false, "thursday": true, "wednesday": true}'
    change_column_default :tenant_settings, :working_days, new_default
  end

  def down
    # Intentionally no-op - we don't want to re-enable Sunday as working day
  end
end
