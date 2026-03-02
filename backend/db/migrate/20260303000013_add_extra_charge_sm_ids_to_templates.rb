# frozen_string_literal: true

# Add 4 new charge types with both PO auto-link columns and rate % columns:
# - Builds Contingency
# - Project Prelims
# - Project Management
# - Maintenance Fee
#
# Also adds charge_po_allocations JSONB for per-PO percentage splits when
# a charge links to multiple POs (e.g. {"overheads": {"12": 60, "45": 40}}).
class AddExtraChargeSmIdsToTemplates < ActiveRecord::Migration[7.2]
  def change
    t = :sm_schedule_master_templates

    # PO auto-link arrays (SmScheduleMaster IDs)
    add_column t, :charge_builds_contingency_sm_ids, :jsonb, default: [], if_not_exists: true
    add_column t, :charge_project_prelims_sm_ids, :jsonb, default: [], if_not_exists: true
    add_column t, :charge_project_management_sm_ids, :jsonb, default: [], if_not_exists: true
    add_column t, :charge_maintenance_fee_sm_ids, :jsonb, default: [], if_not_exists: true

    # Per-template rate overrides for the new charge types
    add_column t, :default_builds_contingency_percent, :decimal, precision: 5, scale: 2, if_not_exists: true
    add_column t, :default_project_prelims_percent, :decimal, precision: 5, scale: 2, if_not_exists: true
    add_column t, :default_project_management_percent, :decimal, precision: 5, scale: 2, if_not_exists: true
    add_column t, :default_maintenance_fee_percent, :decimal, precision: 5, scale: 2, if_not_exists: true

    # Per-PO allocation percentages (all charge types in one column)
    # Format: {"construction_insurance": {"12": 60, "45": 40}, "overheads": {"67": 100}}
    add_column t, :charge_po_allocations, :jsonb, default: {}, if_not_exists: true
  end
end
