# frozen_string_literal: true

# Phase 1: Create Tenant Model
#
# Creates the Tenant table as THE SSoT for multi-tenancy.
# This separates multi-tenancy concerns from CorporateGroup (business grouping).
#
# Tenant model will own:
# - Multi-tenancy isolation (acts_as_tenant)
# - Credentials (absorbed from Organization)
# - Storage configuration (absorbed from Organization)
# - All business data via tenant_id FK
#
class CreateTenants < ActiveRecord::Migration[8.0]
  def change
    create_table :tenants do |t|
      # Core identification
      t.string :name, null: false
      t.string :slug, null: false

      # Multi-tenancy configuration (moved from CorporateGroup)
      t.string :tier, default: 'shared', null: false  # shared | dedicated
      t.string :environment, default: 'production', null: false  # staging | beta | production
      t.boolean :is_master_tenant, default: false, null: false

      # Status
      t.boolean :active, default: true, null: false

      # Branding (optional - can be overridden in TenantSetting)
      t.string :website
      t.string :logo_url
      t.string :primary_color
      t.string :secondary_color

      # Future: document provider (will absorb from Organization)
      t.string :document_provider, default: 'sharepoint'
      t.bigint :document_provider_credential_id

      t.timestamps
    end

    # Unique constraints
    add_index :tenants, :name, unique: true
    add_index :tenants, :slug, unique: true

    # Common query indexes
    add_index :tenants, :is_master_tenant
    add_index :tenants, :tier
    add_index :tenants, :environment
    add_index :tenants, :active
  end
end
