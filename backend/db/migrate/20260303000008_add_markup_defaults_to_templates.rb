# frozen_string_literal: true

# Add per-template markup rate overrides to SmScheduleMasterTemplate.
# All columns are nullable — null means "use global SmSetting default".
# This allows different templates (Standard House vs Custom House) to have
# different markup rates while sharing a common fallback.
class AddMarkupDefaultsToTemplates < ActiveRecord::Migration[7.2]
  def change
    add_column :sm_schedule_master_templates, :default_builder_margin_percent, :decimal, precision: 5, scale: 2
    add_column :sm_schedule_master_templates, :default_escalation_percent, :decimal, precision: 5, scale: 2
    add_column :sm_schedule_master_templates, :pc_ps_markup_cap_percent, :decimal, precision: 5, scale: 2
    add_column :sm_schedule_master_templates, :default_construction_insurance_percent, :decimal, precision: 5, scale: 2
    add_column :sm_schedule_master_templates, :default_overheads_percent, :decimal, precision: 5, scale: 2
    add_column :sm_schedule_master_templates, :default_qleave_rate_percent, :decimal, precision: 6, scale: 4
  end
end
