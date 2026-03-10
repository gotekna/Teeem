# frozen_string_literal: true

# Phase 1a of Shared Config Records: Allow tenant_id to be NULL on config tables.
#
# Records with tenant_id = NULL are "global" (shared) records visible to all tenants
# via acts_as_tenant's `has_global_records: true` option.
#
# Only tables that currently have `null: false` on tenant_id need this migration.
# Tables already allowing NULL are unaffected.
#
# This migration makes NO data changes - it only relaxes the schema constraint.
# Global records will be created in a separate data migration (Phase 2).
class AllowNullTenantOnConfigTables < ActiveRecord::Migration[7.2]
  def change
    # These 30 tables currently have `tenant_id NOT NULL` and need it relaxed
    # to support global (shared) config records with tenant_id = NULL.
    tables_to_update = %i[
      claim_invoice_templates
      claim_stage_template_lines
      claim_stage_templates
      colour_selection_templates
      cost_centres
      custom_quote_templates
      email_templates
      folder_templates
      foundation_views
      gst_codes
      invoice_templates
      job_tabs
      plan_categories
      plan_types
      quantity_variables
      quote_templates
      recipe_categories
      recipes
      sm_hold_reasons
      sm_resources
      sm_schedule_master_document_types
      sm_stages
      specification_templates
      supervisor_checklist_templates
      takeoff_templates
      tender_headers
      tenders
      warehouse_folder_document_types
      whs_induction_templates
      whs_inspection_templates
    ]

    tables_to_update.each do |table|
      change_column_null table, :tenant_id, true
    end
  end
end
