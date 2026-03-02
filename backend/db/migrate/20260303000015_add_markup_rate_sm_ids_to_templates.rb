# frozen_string_literal: true

# Add PO auto-link arrays for the 3 markup rate types
# (Builder Margin, Escalation, PC/PS Cap) so they can also
# be linked to specific POs on the template, like charges.
class AddMarkupRateSmIdsToTemplates < ActiveRecord::Migration[7.2]
  def change
    add_column :sm_schedule_master_templates, :charge_builder_margin_sm_ids, :jsonb, default: []
    add_column :sm_schedule_master_templates, :charge_escalation_sm_ids, :jsonb, default: []
    add_column :sm_schedule_master_templates, :charge_pc_ps_cap_sm_ids, :jsonb, default: []
  end
end
