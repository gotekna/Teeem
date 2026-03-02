# frozen_string_literal: true

class AddChargeSmIdsToSmSettings < ActiveRecord::Migration[7.2]
  def change
    add_column :sm_settings, :charge_construction_insurance_sm_id, :bigint
    add_column :sm_settings, :charge_qleave_sm_id, :bigint
    add_column :sm_settings, :charge_overheads_sm_id, :bigint
    add_column :sm_settings, :charge_qbcc_insurance_sm_id, :bigint

    add_foreign_key :sm_settings, :sm_schedule_masters, column: :charge_construction_insurance_sm_id, on_delete: :nullify
    add_foreign_key :sm_settings, :sm_schedule_masters, column: :charge_qleave_sm_id, on_delete: :nullify
    add_foreign_key :sm_settings, :sm_schedule_masters, column: :charge_overheads_sm_id, on_delete: :nullify
    add_foreign_key :sm_settings, :sm_schedule_masters, column: :charge_qbcc_insurance_sm_id, on_delete: :nullify
  end
end
