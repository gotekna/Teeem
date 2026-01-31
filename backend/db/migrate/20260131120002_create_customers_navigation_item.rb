class CreateCustomersNavigationItem < ActiveRecord::Migration[7.1]
  def up
    # Create "Customers" navigation item - visible only to TEEEM (tenant 1)
    # Position at 50 to place it after main items but not at the very end
    NavigationItem.create!(
      name: "Customers",
      href: "/admin/tenants",
      icon: "users",
      position: 50,
      is_active: true,
      visible_to_tenant_ids: [1],  # TEEEM only
      visible_to_roles: []  # All roles within tenant 1
    )
  end

  def down
    NavigationItem.find_by(href: "/admin/tenants")&.destroy
  end
end
