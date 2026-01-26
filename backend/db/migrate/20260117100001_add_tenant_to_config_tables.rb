# frozen_string_literal: true

# Multi-tenancy Phase 1: Add company_group_id to configuration tables
# This enables tenant isolation for configuration data like job types, statuses, etc.
#
# Note: We use company_group_id (not corporate_group_id) to match existing convention
# in the codebase (see contacts, corporate_companies tables).
class AddTenantToConfigTables < ActiveRecord::Migration[8.0]
  def change
    # Configuration tables - Job Setup
    add_reference :job_types, :company_group, foreign_key: { to_table: :corporate_groups }, index: true
    add_reference :job_statuses, :company_group, foreign_key: { to_table: :corporate_groups }, index: true
    add_reference :job_stages, :company_group, foreign_key: { to_table: :corporate_groups }, index: true
    add_reference :job_type_statuses, :company_group, foreign_key: { to_table: :corporate_groups }, index: true
    add_reference :job_status_stages, :company_group, foreign_key: { to_table: :corporate_groups }, index: true
    add_reference :job_tabs, :company_group, foreign_key: { to_table: :corporate_groups }, index: true

    # Configuration tables - Contact Types
    add_reference :contact_types, :company_group, foreign_key: { to_table: :corporate_groups }, index: true

    # Configuration tables - Document Types
    add_reference :document_types, :company_group, foreign_key: { to_table: :corporate_groups }, index: true

    # Configuration tables - Schedule Master Templates
    add_reference :sm_schedule_master_templates, :company_group, foreign_key: { to_table: :corporate_groups }, index: true

    # Configuration tables - Entity Tabs
    add_reference :entity_tabs, :company_group, foreign_key: { to_table: :corporate_groups }, index: true
    add_reference :corporate_entity_tabs, :company_group, foreign_key: { to_table: :corporate_groups }, index: true

    # Configuration tables - Public Holidays
    add_reference :public_holidays, :company_group, foreign_key: { to_table: :corporate_groups }, index: true

    # Configuration tables - Meeting Types (if exists)
    if table_exists?(:meeting_types)
      add_reference :meeting_types, :company_group, foreign_key: { to_table: :corporate_groups }, index: true
    end

    # Configuration tables - Asset Categories
    if table_exists?(:asset_categories)
      add_reference :asset_categories, :company_group, foreign_key: { to_table: :corporate_groups }, index: true
    end

    # Add composite indexes for tenant-scoped uniqueness
    # These will be used after migration to enforce unique names per tenant
    add_index :job_types, [:company_group_id, :name], unique: true, name: 'idx_job_types_tenant_name', where: 'company_group_id IS NOT NULL'
    add_index :job_statuses, [:company_group_id, :name], unique: true, name: 'idx_job_statuses_tenant_name', where: 'company_group_id IS NOT NULL'
    add_index :job_stages, [:company_group_id, :name], unique: true, name: 'idx_job_stages_tenant_name', where: 'company_group_id IS NOT NULL'
    add_index :contact_types, [:company_group_id, :name], unique: true, name: 'idx_contact_types_tenant_name', where: 'company_group_id IS NOT NULL'
    add_index :sm_schedule_master_templates, [:company_group_id, :name], unique: true, name: 'idx_sm_templates_tenant_name', where: 'company_group_id IS NOT NULL'
  end
end
