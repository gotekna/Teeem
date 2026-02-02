# frozen_string_literal: true

# Rename CorporateGroup → CompanyGroup
# The model name was confusing because it's for business grouping, not multi-tenancy.
# Foreign keys already use company_group_id, so only table names change.
class RenameCorporateGroupsToCompanyGroups < ActiveRecord::Migration[8.0]
  def change
    # Rename main table
    rename_table :corporate_groups, :company_groups

    # Rename membership table
    rename_table :contact_corporate_group_memberships, :contact_company_group_memberships

    # Update foreign key constraints to reference new table name
    # (Rails will handle this automatically with rename_table)

    # Update indexes that have explicit names referencing old table
    # The index names will be auto-updated by Rails, but we should rename
    # any that use 'corporate_group' in their name for clarity

    # Rename unique index on company_groups
    if index_exists?(:company_groups, :name, name: 'index_corporate_groups_on_name')
      rename_index :company_groups, 'index_corporate_groups_on_name', 'index_company_groups_on_name'
    end

    if index_exists?(:company_groups, :slug, name: 'index_corporate_groups_on_slug')
      rename_index :company_groups, 'index_corporate_groups_on_slug', 'index_company_groups_on_slug'
    end

    if index_exists?(:company_groups, :environment, name: 'index_corporate_groups_on_environment')
      rename_index :company_groups, 'index_corporate_groups_on_environment', 'index_company_groups_on_environment'
    end

    if index_exists?(:company_groups, :tier, name: 'index_corporate_groups_on_tier')
      rename_index :company_groups, 'index_corporate_groups_on_tier', 'index_company_groups_on_tier'
    end

    if index_exists?(:company_groups, :is_master_tenant, name: 'index_corporate_groups_on_is_master_tenant')
      rename_index :company_groups, 'index_corporate_groups_on_is_master_tenant', 'index_company_groups_on_is_master_tenant'
    end

    if index_exists?(:company_groups, :tenant_id, name: 'index_corporate_groups_on_tenant_id')
      rename_index :company_groups, 'index_corporate_groups_on_tenant_id', 'index_company_groups_on_tenant_id'
    end

    # Rename indexes on contact_company_group_memberships
    if index_exists?(:contact_company_group_memberships, :company_group_id, name: 'index_contact_corporate_group_memberships_on_company_group_id')
      rename_index :contact_company_group_memberships, 'index_contact_corporate_group_memberships_on_company_group_id', 'index_contact_company_group_memberships_on_company_group_id'
    end

    if index_exists?(:contact_company_group_memberships, :company_id, name: 'index_contact_corporate_group_memberships_on_company_id')
      rename_index :contact_company_group_memberships, 'index_contact_corporate_group_memberships_on_company_id', 'index_contact_company_group_memberships_on_company_id'
    end

    if index_exists?(:contact_company_group_memberships, :contact_id, name: 'index_contact_corporate_group_memberships_on_contact_id')
      rename_index :contact_company_group_memberships, 'index_contact_corporate_group_memberships_on_contact_id', 'index_contact_company_group_memberships_on_contact_id'
    end

    if index_exists?(:contact_company_group_memberships, :tenant_id, name: 'index_contact_corporate_group_memberships_on_tenant_id')
      rename_index :contact_company_group_memberships, 'index_contact_corporate_group_memberships_on_tenant_id', 'index_contact_company_group_memberships_on_tenant_id'
    end
  end
end
