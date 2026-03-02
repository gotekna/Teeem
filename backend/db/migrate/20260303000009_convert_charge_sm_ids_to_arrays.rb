# frozen_string_literal: true

# Convert charge → SM task links from single FK (bigint) to JSONB arrays.
# This allows each charge type to link to multiple SM tasks (and thus multiple POs).
# Example: Overheads charge split across 2 POs.
class ConvertChargeSmIdsToArrays < ActiveRecord::Migration[7.2]
  def up
    # Add new JSONB array columns
    add_column :sm_schedule_master_templates, :charge_construction_insurance_sm_ids, :jsonb, default: []
    add_column :sm_schedule_master_templates, :charge_qleave_sm_ids, :jsonb, default: []
    add_column :sm_schedule_master_templates, :charge_overheads_sm_ids, :jsonb, default: []
    add_column :sm_schedule_master_templates, :charge_qbcc_insurance_sm_ids, :jsonb, default: []

    # Migrate existing single FK data to arrays
    execute <<-SQL
      UPDATE sm_schedule_master_templates
      SET charge_construction_insurance_sm_ids = CASE
        WHEN charge_construction_insurance_sm_id IS NOT NULL THEN jsonb_build_array(charge_construction_insurance_sm_id)
        ELSE '[]'::jsonb
      END,
      charge_qleave_sm_ids = CASE
        WHEN charge_qleave_sm_id IS NOT NULL THEN jsonb_build_array(charge_qleave_sm_id)
        ELSE '[]'::jsonb
      END,
      charge_overheads_sm_ids = CASE
        WHEN charge_overheads_sm_id IS NOT NULL THEN jsonb_build_array(charge_overheads_sm_id)
        ELSE '[]'::jsonb
      END,
      charge_qbcc_insurance_sm_ids = CASE
        WHEN charge_qbcc_insurance_sm_id IS NOT NULL THEN jsonb_build_array(charge_qbcc_insurance_sm_id)
        ELSE '[]'::jsonb
      END
    SQL

    # Remove old single FK columns and their foreign keys
    remove_foreign_key :sm_schedule_master_templates, column: :charge_construction_insurance_sm_id
    remove_foreign_key :sm_schedule_master_templates, column: :charge_qleave_sm_id
    remove_foreign_key :sm_schedule_master_templates, column: :charge_overheads_sm_id
    remove_foreign_key :sm_schedule_master_templates, column: :charge_qbcc_insurance_sm_id

    remove_column :sm_schedule_master_templates, :charge_construction_insurance_sm_id
    remove_column :sm_schedule_master_templates, :charge_qleave_sm_id
    remove_column :sm_schedule_master_templates, :charge_overheads_sm_id
    remove_column :sm_schedule_master_templates, :charge_qbcc_insurance_sm_id
  end

  def down
    add_column :sm_schedule_master_templates, :charge_construction_insurance_sm_id, :bigint
    add_column :sm_schedule_master_templates, :charge_qleave_sm_id, :bigint
    add_column :sm_schedule_master_templates, :charge_overheads_sm_id, :bigint
    add_column :sm_schedule_master_templates, :charge_qbcc_insurance_sm_id, :bigint

    # Migrate first element back to single FK
    execute <<-SQL
      UPDATE sm_schedule_master_templates
      SET charge_construction_insurance_sm_id = (charge_construction_insurance_sm_ids->>0)::bigint,
          charge_qleave_sm_id = (charge_qleave_sm_ids->>0)::bigint,
          charge_overheads_sm_id = (charge_overheads_sm_ids->>0)::bigint,
          charge_qbcc_insurance_sm_id = (charge_qbcc_insurance_sm_ids->>0)::bigint
    SQL

    remove_column :sm_schedule_master_templates, :charge_construction_insurance_sm_ids
    remove_column :sm_schedule_master_templates, :charge_qleave_sm_ids
    remove_column :sm_schedule_master_templates, :charge_overheads_sm_ids
    remove_column :sm_schedule_master_templates, :charge_qbcc_insurance_sm_ids
  end
end
