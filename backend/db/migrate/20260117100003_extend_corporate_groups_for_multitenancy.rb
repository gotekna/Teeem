# frozen_string_literal: true

# Multi-tenancy Phase 1: Extend CorporateGroup to serve as Tenant model
# Adds tier (shared/dedicated), environment, and slug for subdomain routing
class ExtendCorporateGroupsForMultitenancy < ActiveRecord::Migration[8.0]
  def change
    add_column :corporate_groups, :slug, :string
    add_column :corporate_groups, :tier, :integer, default: 0  # 0=shared, 1=dedicated
    add_column :corporate_groups, :environment, :integer, default: 0  # 0=staging, 1=beta, 2=production
    add_column :corporate_groups, :is_master_tenant, :boolean, default: false
    add_column :corporate_groups, :website, :string
    add_column :corporate_groups, :logo_url, :string
    add_column :corporate_groups, :primary_color, :string
    add_column :corporate_groups, :secondary_color, :string

    add_index :corporate_groups, :slug, unique: true
    add_index :corporate_groups, :tier
    add_index :corporate_groups, :environment
    add_index :corporate_groups, :is_master_tenant
  end
end
