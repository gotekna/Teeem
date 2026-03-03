# FRC: The migration 20260207090000_split_sales_parent_from_document_tab used LIMIT 1
# without tenant scoping, so only ONE tenant's Sales tab was split into parent+children.
# Pilgrim Homes (and any future tenants) never got the Sales system parent tab.
# Similarly, the Site system parent tab was never created for Pilgrim Homes.
#
# Additionally, config sync created children with parent_ids pointing to OTHER tenants'
# records (cross-tenant FK references) because the parent didn't exist locally.
#
# This migration:
# 1. Creates missing Sales/Site system parent tabs for all tenants that lack them
# 2. Fixes orphaned children to point to the correct local parent
# 3. Fixes self-referential parent_id on sales-documents records
class FixMissingSalesAndSiteTabsForAllTenants < ActiveRecord::Migration[8.0]
  def up
    # Process each tenant independently
    Tenant.find_each do |tenant|
      ActsAsTenant.with_tenant(tenant) do
        job_wt = WarehouseType.find_by(code: "job")
        next unless job_wt

        fix_sales_tab(tenant, job_wt)
        fix_site_tab(tenant, job_wt)
      end
    end
  end

  def down
    # Data fix only - no rollback needed
  end

  private

  def fix_sales_tab(tenant, job_wt)
    sales_parent = WarehouseFolder.find_by(
      tab_key: "sales",
      warehouse_type_id: job_wt.id,
      tenant_id: tenant.id
    )

    # Check if children exist (they may have been synced without a parent)
    sales_docs = WarehouseFolder.find_by(tab_key: "sales-documents", tenant_id: tenant.id)
    sales_plans = WarehouseFolder.find_by(tab_key: "sales-plans", tenant_id: tenant.id)
    colours = WarehouseFolder.find_by(tab_key: "colours", tenant_id: tenant.id)

    has_children = sales_docs || sales_plans || colours

    if sales_parent.nil? && has_children
      # Create the missing Sales system parent tab
      sales_parent = WarehouseFolder.create!(
        name: "Sales",
        display_name: "Sales",
        tab_key: "sales",
        tab_type: "system",
        tab_group: "data",
        warehouse_type_id: job_wt.id,
        tenant_id: tenant.id,
        is_system: true,
        enabled: true,
        warehouse_enabled: false,
        icon_name: "ShoppingCart",
        order_position: next_order_position(job_wt.id, tenant.id),
        sync_key: "job--sales"
      )
      say "Created Sales parent tab for tenant #{tenant.id} (#{tenant.name}), id=#{sales_parent.id}"
    end

    return unless sales_parent

    # Fix children to point to the correct local parent
    [sales_docs, sales_plans, colours].compact.each do |child|
      if child.parent_id != sales_parent.id
        old_parent = child.parent_id
        child.update_columns(parent_id: sales_parent.id)
        say "  Fixed #{child.tab_key} parent_id: #{old_parent} -> #{sales_parent.id}"
      end
    end
  end

  def fix_site_tab(tenant, job_wt)
    site_parent = WarehouseFolder.find_by(
      tab_key: "site",
      warehouse_type_id: job_wt.id,
      tenant_id: tenant.id
    )

    # Check for orphaned site children
    whs = WarehouseFolder.find_by(tab_key: "whs", tenant_id: tenant.id)
    site_docs = WarehouseFolder.find_by(tab_key: "site-docs", tenant_id: tenant.id)
    rain_log = WarehouseFolder.find_by(tab_key: "rain-log", tenant_id: tenant.id)

    has_children = whs || site_docs || rain_log

    if site_parent.nil? && has_children
      # Create the missing Site system parent tab
      site_parent = WarehouseFolder.create!(
        name: "Site",
        display_name: "Site",
        tab_key: "site",
        tab_type: "system",
        tab_group: "data",
        warehouse_type_id: job_wt.id,
        tenant_id: tenant.id,
        is_system: true,
        enabled: true,
        warehouse_enabled: false,
        icon_name: "HardHat",
        order_position: next_order_position(job_wt.id, tenant.id),
        sync_key: "job--site"
      )
      say "Created Site parent tab for tenant #{tenant.id} (#{tenant.name}), id=#{site_parent.id}"
    end

    return unless site_parent

    # Fix children to point to the correct local parent
    [whs, site_docs, rain_log].compact.each do |child|
      if child.parent_id != site_parent.id
        old_parent = child.parent_id
        child.update_columns(parent_id: site_parent.id)
        say "  Fixed #{child.tab_key} parent_id: #{old_parent} -> #{site_parent.id}"
      end
    end
  end

  def next_order_position(warehouse_type_id, tenant_id)
    max = WarehouseFolder.where(
      warehouse_type_id: warehouse_type_id,
      tenant_id: tenant_id,
      parent_id: nil
    ).maximum(:order_position) || 0
    max + 1
  end
end
