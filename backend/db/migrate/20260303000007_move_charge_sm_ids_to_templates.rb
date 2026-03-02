# frozen_string_literal: true

class MoveChargeSmIdsToTemplates < ActiveRecord::Migration[7.2]
  def change
    # Add to templates (per-template config)
    add_column :sm_schedule_master_templates, :charge_construction_insurance_sm_id, :bigint
    add_column :sm_schedule_master_templates, :charge_qleave_sm_id, :bigint
    add_column :sm_schedule_master_templates, :charge_overheads_sm_id, :bigint
    add_column :sm_schedule_master_templates, :charge_qbcc_insurance_sm_id, :bigint

    add_foreign_key :sm_schedule_master_templates, :sm_schedule_masters, column: :charge_construction_insurance_sm_id, on_delete: :nullify
    add_foreign_key :sm_schedule_master_templates, :sm_schedule_masters, column: :charge_qleave_sm_id, on_delete: :nullify
    add_foreign_key :sm_schedule_master_templates, :sm_schedule_masters, column: :charge_overheads_sm_id, on_delete: :nullify
    add_foreign_key :sm_schedule_master_templates, :sm_schedule_masters, column: :charge_qbcc_insurance_sm_id, on_delete: :nullify

    # Remove from settings (was global, now per-template)
    remove_foreign_key :sm_settings, :sm_schedule_masters, column: :charge_construction_insurance_sm_id
    remove_foreign_key :sm_settings, :sm_schedule_masters, column: :charge_qleave_sm_id
    remove_foreign_key :sm_settings, :sm_schedule_masters, column: :charge_overheads_sm_id
    remove_foreign_key :sm_settings, :sm_schedule_masters, column: :charge_qbcc_insurance_sm_id

    remove_column :sm_settings, :charge_construction_insurance_sm_id, :bigint
    remove_column :sm_settings, :charge_qleave_sm_id, :bigint
    remove_column :sm_settings, :charge_overheads_sm_id, :bigint
    remove_column :sm_settings, :charge_qbcc_insurance_sm_id, :bigint
  end
end
