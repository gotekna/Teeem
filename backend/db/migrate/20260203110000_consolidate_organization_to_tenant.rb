# frozen_string_literal: true

# SSoT Migration (Feb 2026): Consolidate Organization to Tenant
#
# Organization was a redundant layer between Tenant and credentials.
# Every tenant has exactly one organization, and code always used:
#   current_organization = current_tenant.organizations.first
#
# This migration:
# 1. Adds tenant_id to tables that only had organization_id
# 2. Populates tenant_id from organization.tenant_id
# 3. Keeps organization_id temporarily for rollback safety
#
# After verifying code works, a follow-up migration will:
# - Remove organization_id columns
# - Drop the organizations table
#
class ConsolidateOrganizationToTenant < ActiveRecord::Migration[7.1]
  def up
    # Tables that need tenant_id added
    tables_to_migrate = %w[
      cloudflare_credentials
      desktop_clients
      email_drafts
      email_subscriptions
      microsoft_credentials
      performance_requests
      polaris_credentials
      s3_compatible_credentials
      stripe_configurations
      sync_exclusion_rules
    ]

    tables_to_migrate.each do |table|
      # Skip if tenant_id already exists (shouldn't happen but be safe)
      next if column_exists?(table, :tenant_id) && column_exists?(table, :tenant_id, :bigint)

      # Check if this is microsoft_credentials which has a STRING tenant_id (Azure tenant)
      if table == 'microsoft_credentials'
        # Rename the Azure tenant_id to azure_tenant_id first
        if column_exists?(:microsoft_credentials, :tenant_id)
          rename_column :microsoft_credentials, :tenant_id, :azure_tenant_id
        end
      end

      # Add tenant_id column
      unless column_exists?(table, :tenant_id)
        add_column table, :tenant_id, :bigint
        add_index table, :tenant_id, name: "index_#{table}_on_tenant_id"
      end
    end

    # Populate tenant_id from organization.tenant_id
    execute <<-SQL
      -- cloudflare_credentials
      UPDATE cloudflare_credentials cc
      SET tenant_id = o.tenant_id
      FROM organizations o
      WHERE cc.organization_id = o.id AND cc.tenant_id IS NULL;

      -- desktop_clients
      UPDATE desktop_clients dc
      SET tenant_id = o.tenant_id
      FROM organizations o
      WHERE dc.organization_id = o.id AND dc.tenant_id IS NULL;

      -- email_drafts
      UPDATE email_drafts ed
      SET tenant_id = o.tenant_id
      FROM organizations o
      WHERE ed.organization_id = o.id AND ed.tenant_id IS NULL;

      -- email_subscriptions
      UPDATE email_subscriptions es
      SET tenant_id = o.tenant_id
      FROM organizations o
      WHERE es.organization_id = o.id AND es.tenant_id IS NULL;

      -- microsoft_credentials
      UPDATE microsoft_credentials mc
      SET tenant_id = o.tenant_id
      FROM organizations o
      WHERE mc.organization_id = o.id AND mc.tenant_id IS NULL;

      -- performance_requests
      UPDATE performance_requests pr
      SET tenant_id = o.tenant_id
      FROM organizations o
      WHERE pr.organization_id = o.id AND pr.tenant_id IS NULL;

      -- polaris_credentials
      UPDATE polaris_credentials pc
      SET tenant_id = o.tenant_id
      FROM organizations o
      WHERE pc.organization_id = o.id AND pc.tenant_id IS NULL;

      -- s3_compatible_credentials
      UPDATE s3_compatible_credentials sc
      SET tenant_id = o.tenant_id
      FROM organizations o
      WHERE sc.organization_id = o.id AND sc.tenant_id IS NULL;

      -- stripe_configurations
      UPDATE stripe_configurations sc
      SET tenant_id = o.tenant_id
      FROM organizations o
      WHERE sc.organization_id = o.id AND sc.tenant_id IS NULL;

      -- sync_exclusion_rules
      UPDATE sync_exclusion_rules ser
      SET tenant_id = o.tenant_id
      FROM organizations o
      WHERE ser.organization_id = o.id AND ser.tenant_id IS NULL;
    SQL

    # Add foreign key constraints
    tables_to_migrate.each do |table|
      add_foreign_key table, :tenants, column: :tenant_id, on_delete: :cascade if table_exists?(:tenants)
    rescue => e
      Rails.logger.warn "Could not add foreign key for #{table}: #{e.message}"
    end
  end

  def down
    # Rename azure_tenant_id back to tenant_id for microsoft_credentials
    if column_exists?(:microsoft_credentials, :azure_tenant_id)
      remove_column :microsoft_credentials, :tenant_id if column_exists?(:microsoft_credentials, :tenant_id, :bigint)
      rename_column :microsoft_credentials, :azure_tenant_id, :tenant_id
    end

    # Remove tenant_id from other tables
    %w[
      cloudflare_credentials
      desktop_clients
      email_drafts
      email_subscriptions
      performance_requests
      polaris_credentials
      s3_compatible_credentials
      stripe_configurations
      sync_exclusion_rules
    ].each do |table|
      remove_column table, :tenant_id if column_exists?(table, :tenant_id, :bigint)
    end
  end
end
