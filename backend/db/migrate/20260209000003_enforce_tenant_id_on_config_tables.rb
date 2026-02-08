# frozen_string_literal: true

# Enforce NOT NULL on tenant_id and re-scope unique indexes to include tenant_id.
# This migration MUST run after backfill (20260209000002) so no NULLs remain.
class EnforceTenantIdOnConfigTables < ActiveRecord::Migration[8.0]
  def up
    # ========================================================================
    # Step 1: Add NOT NULL constraint to all 20 tables + job_tabs
    # ========================================================================
    all_tables = %w[
      folder_templates claim_invoice_templates invoice_templates
      specification_templates colour_selection_templates sm_stages
      sm_hold_reasons sm_resources sm_schedule_master_document_types
      recipe_categories recipes quantity_variables
      warehouse_folder_document_types whs_induction_templates
      whs_inspection_templates email_templates plan_types plan_categories
      cost_centres supervisor_checklist_templates job_tabs
    ]

    all_tables.each do |table|
      change_column_null table, :tenant_id, false
    end

    # ========================================================================
    # Step 2: Add foreign key constraints
    # ========================================================================
    all_tables.each do |table|
      add_foreign_key table, :tenants, column: :tenant_id, on_delete: :cascade
    end

    # ========================================================================
    # Step 3: Re-scope unique indexes to include tenant_id
    # ========================================================================

    # job_tabs: slug → [tenant_id, slug]
    remove_index :job_tabs, name: "index_job_tabs_on_slug"
    add_index :job_tabs, [:tenant_id, :slug], unique: true, name: "index_job_tabs_on_tenant_id_and_slug"

    # sm_hold_reasons: name → [tenant_id, name]
    remove_index :sm_hold_reasons, name: "index_sm_hold_reasons_on_name"
    add_index :sm_hold_reasons, [:tenant_id, :name], unique: true, name: "index_sm_hold_reasons_on_tenant_id_and_name"

    # sm_resources: code (partial) → [tenant_id, code] (partial)
    remove_index :sm_resources, name: "index_sm_resources_on_code"
    add_index :sm_resources, [:tenant_id, :code], unique: true,
              where: "(code IS NOT NULL)", name: "index_sm_resources_on_tenant_id_and_code"

    # sm_schedule_master_document_types: [sm_schedule_master_id, document_type_id] → [tenant_id, ...]
    remove_index :sm_schedule_master_document_types, name: "idx_sm_master_doc_type_unique"
    add_index :sm_schedule_master_document_types,
              [:tenant_id, :sm_schedule_master_id, :document_type_id],
              unique: true, name: "idx_sm_master_doc_type_tenant_unique"

    # recipe_categories: code → [tenant_id, code]
    remove_index :recipe_categories, name: "index_recipe_categories_on_code"
    add_index :recipe_categories, [:tenant_id, :code], unique: true,
              name: "index_recipe_categories_on_tenant_id_and_code"

    # recipes: code → [tenant_id, code]
    remove_index :recipes, name: "index_recipes_on_code"
    add_index :recipes, [:tenant_id, :code], unique: true,
              name: "index_recipes_on_tenant_id_and_code"

    # quantity_variables: variable_name → [tenant_id, variable_name]
    remove_index :quantity_variables, name: "index_quantity_variables_on_variable_name"
    add_index :quantity_variables, [:tenant_id, :variable_name], unique: true,
              name: "index_quantity_variables_on_tenant_id_and_variable_name"

    # warehouse_folder_document_types: [warehouse_folder_id, document_type_id] → [tenant_id, ...]
    remove_index :warehouse_folder_document_types, name: "idx_wfdt_unique"
    add_index :warehouse_folder_document_types,
              [:tenant_id, :warehouse_folder_id, :document_type_id],
              unique: true, name: "idx_wfdt_tenant_unique"

    # email_templates: [user_id, name] → [tenant_id, user_id, name]
    remove_index :email_templates, name: "index_email_templates_on_user_id_and_name"
    add_index :email_templates, [:tenant_id, :user_id, :name], unique: true,
              name: "index_email_templates_on_tenant_user_name"

    # plan_types: code → [tenant_id, code], name → [tenant_id, name]
    remove_index :plan_types, name: "index_plan_types_on_code"
    remove_index :plan_types, name: "index_plan_types_on_name"
    add_index :plan_types, [:tenant_id, :code], unique: true,
              name: "index_plan_types_on_tenant_id_and_code"
    add_index :plan_types, [:tenant_id, :name], unique: true,
              name: "index_plan_types_on_tenant_id_and_name"

    # plan_categories: code → [tenant_id, code]
    remove_index :plan_categories, name: "index_plan_categories_on_code"
    add_index :plan_categories, [:tenant_id, :code], unique: true,
              name: "index_plan_categories_on_tenant_id_and_code"

    # cost_centres: code → [tenant_id, code]
    remove_index :cost_centres, name: "index_cost_centres_on_code"
    add_index :cost_centres, [:tenant_id, :code], unique: true,
              name: "index_cost_centres_on_tenant_id_and_code"

    # supervisor_checklist_templates: name → [tenant_id, name]
    remove_index :supervisor_checklist_templates, name: "index_supervisor_checklist_templates_on_name"
    add_index :supervisor_checklist_templates, [:tenant_id, :name], unique: true,
              name: "index_supervisor_checklist_templates_on_tenant_id_and_name"
  end

  def down
    # Reverse unique indexes back to original
    remove_index :job_tabs, name: "index_job_tabs_on_tenant_id_and_slug"
    add_index :job_tabs, :slug, unique: true, name: "index_job_tabs_on_slug"

    remove_index :sm_hold_reasons, name: "index_sm_hold_reasons_on_tenant_id_and_name"
    add_index :sm_hold_reasons, :name, unique: true, name: "index_sm_hold_reasons_on_name"

    remove_index :sm_resources, name: "index_sm_resources_on_tenant_id_and_code"
    add_index :sm_resources, :code, unique: true, where: "(code IS NOT NULL)", name: "index_sm_resources_on_code"

    remove_index :sm_schedule_master_document_types, name: "idx_sm_master_doc_type_tenant_unique"
    add_index :sm_schedule_master_document_types, [:sm_schedule_master_id, :document_type_id],
              unique: true, name: "idx_sm_master_doc_type_unique"

    remove_index :recipe_categories, name: "index_recipe_categories_on_tenant_id_and_code"
    add_index :recipe_categories, :code, unique: true, name: "index_recipe_categories_on_code"

    remove_index :recipes, name: "index_recipes_on_tenant_id_and_code"
    add_index :recipes, :code, unique: true, name: "index_recipes_on_code"

    remove_index :quantity_variables, name: "index_quantity_variables_on_tenant_id_and_variable_name"
    add_index :quantity_variables, :variable_name, unique: true, name: "index_quantity_variables_on_variable_name"

    remove_index :warehouse_folder_document_types, name: "idx_wfdt_tenant_unique"
    add_index :warehouse_folder_document_types, [:warehouse_folder_id, :document_type_id],
              unique: true, name: "idx_wfdt_unique"

    remove_index :email_templates, name: "index_email_templates_on_tenant_user_name"
    add_index :email_templates, [:user_id, :name], unique: true, name: "index_email_templates_on_user_id_and_name"

    remove_index :plan_types, name: "index_plan_types_on_tenant_id_and_code"
    remove_index :plan_types, name: "index_plan_types_on_tenant_id_and_name"
    add_index :plan_types, :code, unique: true, name: "index_plan_types_on_code"
    add_index :plan_types, :name, unique: true, name: "index_plan_types_on_name"

    remove_index :plan_categories, name: "index_plan_categories_on_tenant_id_and_code"
    add_index :plan_categories, :code, unique: true, name: "index_plan_categories_on_code"

    remove_index :cost_centres, name: "index_cost_centres_on_tenant_id_and_code"
    add_index :cost_centres, :code, unique: true, name: "index_cost_centres_on_code"

    remove_index :supervisor_checklist_templates, name: "index_supervisor_checklist_templates_on_tenant_id_and_name"
    add_index :supervisor_checklist_templates, :name, unique: true, name: "index_supervisor_checklist_templates_on_name"

    # Remove NOT NULL and foreign keys
    all_tables = %w[
      folder_templates claim_invoice_templates invoice_templates
      specification_templates colour_selection_templates sm_stages
      sm_hold_reasons sm_resources sm_schedule_master_document_types
      recipe_categories recipes quantity_variables
      warehouse_folder_document_types whs_induction_templates
      whs_inspection_templates email_templates plan_types plan_categories
      cost_centres supervisor_checklist_templates job_tabs
    ]

    all_tables.each do |table|
      remove_foreign_key table, :tenants, column: :tenant_id
      change_column_null table, :tenant_id, true
    end
  end
end
