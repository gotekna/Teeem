# frozen_string_literal: true

class AddMarkupColumns < ActiveRecord::Migration[7.1]
  def change
    # SmScheduleMaster (template defaults for escalation/markup per task)
    add_column :sm_schedule_masters, :default_escalation_percent, :decimal, precision: 5, scale: 2, default: 0.0
    add_column :sm_schedule_masters, :default_markup_percent, :decimal, precision: 5, scale: 2, default: 0.0

    # SmTask (per-job overrides, editable in Pricing tab)
    add_column :sm_tasks, :escalation_percent, :decimal, precision: 5, scale: 2, default: 0.0
    add_column :sm_tasks, :markup_percent, :decimal, precision: 5, scale: 2, default: 0.0

    # Job (builder margin, flows from SmSetting defaults)
    add_column :jobs, :builder_margin_percent, :decimal, precision: 5, scale: 2, default: 0.0

    # SmSetting (global defaults for pricing)
    add_column :sm_settings, :default_builder_margin_percent, :decimal, precision: 5, scale: 2, default: 0.0
    add_column :sm_settings, :default_escalation_percent, :decimal, precision: 5, scale: 2, default: 0.0
    add_column :sm_settings, :pc_ps_markup_cap_percent, :decimal, precision: 5, scale: 2, default: 25.0
  end
end
