# frozen_string_literal: true

# Add tenant_id column to 20 config tables for multi-tenant sync support.
# Non-breaking: column is nullable, no data changes.
# job_tabs already has tenant_id - excluded from this migration.
class AddTenantIdToConfigTables < ActiveRecord::Migration[8.0]
  def change
    tables = %i[
      folder_templates
      claim_invoice_templates
      invoice_templates
      specification_templates
      colour_selection_templates
      sm_stages
      sm_hold_reasons
      sm_resources
      sm_schedule_master_document_types
      recipe_categories
      recipes
      quantity_variables
      warehouse_folder_document_types
      whs_induction_templates
      whs_inspection_templates
      email_templates
      plan_types
      plan_categories
      cost_centres
      supervisor_checklist_templates
    ]

    tables.each do |table|
      add_reference table, :tenant, null: true, foreign_key: false, index: true
    end
  end
end
