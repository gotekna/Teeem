# frozen_string_literal: true

# Add global default rate % columns for the 4 new charge types
# to sm_settings (singleton config table).
# These serve as fallback when a template doesn't override the rate.
class AddExtraChargeDefaultsToSmSettings < ActiveRecord::Migration[7.2]
  def change
    add_column :sm_settings, :default_builds_contingency_percent, :decimal, precision: 5, scale: 2, default: 0.0
    add_column :sm_settings, :default_project_prelims_percent, :decimal, precision: 5, scale: 2, default: 0.0
    add_column :sm_settings, :default_project_management_percent, :decimal, precision: 5, scale: 2, default: 0.0
    add_column :sm_settings, :default_maintenance_fee_percent, :decimal, precision: 5, scale: 2, default: 0.0
  end
end
