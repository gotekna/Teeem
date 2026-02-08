# frozen_string_literal: true

# Backfill tenant_id for existing config records.
# Strategy: Assign all records to the master tenant (TEEEM, id=1).
# For join tables, inherit from parent FK where possible.
class BackfillTenantIdForConfigTables < ActiveRecord::Migration[8.0]
  def up
    # Find master tenant - TEEEM is always id=1 in production
    master_id = execute("SELECT id FROM tenants WHERE is_master_tenant = true LIMIT 1").first&.fetch("id")
    master_id ||= execute("SELECT id FROM tenants WHERE slug = 'teeem' LIMIT 1").first&.fetch("id")

    unless master_id
      say "No master tenant found - skipping backfill (will need manual assignment)"
      return
    end

    say "Backfilling tenant_id=#{master_id} (master tenant) for config tables..."

    # ========================================================================
    # Strategy 1: Default to master tenant (17 standalone tables)
    # ========================================================================
    standalone_tables = %w[
      folder_templates
      claim_invoice_templates
      invoice_templates
      specification_templates
      colour_selection_templates
      sm_stages
      sm_hold_reasons
      sm_resources
      recipe_categories
      recipes
      quantity_variables
      whs_induction_templates
      whs_inspection_templates
      email_templates
      plan_types
      plan_categories
      cost_centres
      supervisor_checklist_templates
    ]

    standalone_tables.each do |table|
      count = execute("UPDATE #{table} SET tenant_id = #{master_id} WHERE tenant_id IS NULL").cmd_tuples
      say "  #{table}: #{count} records updated"
    end

    # ========================================================================
    # Strategy 2: Inherit from parent FK (join tables)
    # ========================================================================

    # sm_schedule_master_document_types → inherit from sm_schedule_masters.tenant_id
    count = execute(<<~SQL).cmd_tuples
      UPDATE sm_schedule_master_document_types smsdt
      SET tenant_id = sms.tenant_id
      FROM sm_schedule_masters sms
      WHERE smsdt.sm_schedule_master_id = sms.id
        AND smsdt.tenant_id IS NULL
        AND sms.tenant_id IS NOT NULL
    SQL
    say "  sm_schedule_master_document_types (from parent): #{count} records updated"

    # Fallback: any remaining NULL records get master tenant
    count = execute("UPDATE sm_schedule_master_document_types SET tenant_id = #{master_id} WHERE tenant_id IS NULL").cmd_tuples
    say "  sm_schedule_master_document_types (fallback): #{count} records updated" if count > 0

    # warehouse_folder_document_types → inherit from warehouse_folders.tenant_id
    count = execute(<<~SQL).cmd_tuples
      UPDATE warehouse_folder_document_types wfdt
      SET tenant_id = wf.tenant_id
      FROM warehouse_folders wf
      WHERE wfdt.warehouse_folder_id = wf.id
        AND wfdt.tenant_id IS NULL
        AND wf.tenant_id IS NOT NULL
    SQL
    say "  warehouse_folder_document_types (from parent): #{count} records updated"

    # Fallback: any remaining NULL records get master tenant
    count = execute("UPDATE warehouse_folder_document_types SET tenant_id = #{master_id} WHERE tenant_id IS NULL").cmd_tuples
    say "  warehouse_folder_document_types (fallback): #{count} records updated" if count > 0

    # ========================================================================
    # Strategy 3: job_tabs already has tenant_id - backfill NULLs only
    # ========================================================================
    count = execute("UPDATE job_tabs SET tenant_id = #{master_id} WHERE tenant_id IS NULL").cmd_tuples
    say "  job_tabs (backfill NULLs): #{count} records updated"
  end

  def down
    # Reversible: set all tenant_ids back to NULL
    tables = %w[
      folder_templates claim_invoice_templates invoice_templates
      specification_templates colour_selection_templates sm_stages
      sm_hold_reasons sm_resources sm_schedule_master_document_types
      recipe_categories recipes quantity_variables
      warehouse_folder_document_types whs_induction_templates
      whs_inspection_templates email_templates plan_types plan_categories
      cost_centres supervisor_checklist_templates
    ]

    tables.each do |table|
      execute("UPDATE #{table} SET tenant_id = NULL")
    end
  end
end
