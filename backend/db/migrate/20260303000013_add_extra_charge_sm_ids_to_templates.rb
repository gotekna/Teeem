# frozen_string_literal: true

# Add 3 new charge-to-PO auto-link columns for:
# - Builds Contingency
# - Project Prelims
# - Project Management
#
# These follow the same JSONB array pattern as the existing 4 charge columns
# (charge_construction_insurance_sm_ids, etc.) — each stores an array of
# SmScheduleMaster IDs that the charge should auto-link to when markup is calculated.
class AddExtraChargeSmIdsToTemplates < ActiveRecord::Migration[7.2]
  def change
    add_column :sm_schedule_master_templates, :charge_builds_contingency_sm_ids, :jsonb, default: []
    add_column :sm_schedule_master_templates, :charge_project_prelims_sm_ids, :jsonb, default: []
    add_column :sm_schedule_master_templates, :charge_project_management_sm_ids, :jsonb, default: []
  end
end
