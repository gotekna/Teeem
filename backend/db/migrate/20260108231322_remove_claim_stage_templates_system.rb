# frozen_string_literal: true

# Migration: Remove ClaimStageTemplate system
#
# SSoT DECISION: Schedule Master CLAIM tasks are THE ONE source for claim stages
# ClaimStageTemplate was a legacy system that duplicated claim stage definitions
#
# This migration:
# 1. Removes claim_stage_template_id foreign key from job_claim_stages
# 2. Drops the claim_stage_templates table
#
# Claim stages are now created by SmScheduleMasterTemplateCopyService when
# a Schedule Master template is applied to a job.
#
class RemoveClaimStageTemplatesSystem < ActiveRecord::Migration[8.0]
  def up
    # Step 1: Remove foreign key constraint if it exists
    if foreign_key_exists?(:job_claim_stages, :claim_stage_templates)
      remove_foreign_key :job_claim_stages, :claim_stage_templates
    end

    # Step 2: Remove the claim_stage_template_id column from job_claim_stages
    if column_exists?(:job_claim_stages, :claim_stage_template_id)
      remove_column :job_claim_stages, :claim_stage_template_id
    end

    # Step 3: Drop the claim_stage_templates table
    drop_table :claim_stage_templates, if_exists: true
  end

  def down
    # Recreate the claim_stage_templates table
    create_table :claim_stage_templates do |t|
      t.references :job_type, foreign_key: true
      t.string :name, null: false
      t.decimal :percentage, precision: 5, scale: 2, null: false
      t.integer :sequence_order, default: 0, null: false
      t.string :description
      t.string :invoice_match_pattern
      t.boolean :is_active, default: true, null: false

      t.timestamps
    end

    add_index :claim_stage_templates, [:job_type_id, :name], unique: true
    add_index :claim_stage_templates, [:job_type_id, :sequence_order]

    # Re-add column to job_claim_stages
    add_reference :job_claim_stages, :claim_stage_template, foreign_key: true
  end
end
