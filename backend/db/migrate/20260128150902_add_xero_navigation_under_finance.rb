class AddXeroNavigationUnderFinance < ActiveRecord::Migration[8.0]
  def up
    finance_nav = NavigationItem.find_by(name: "Finance")
    return unless finance_nav

    # Add Xero under Finance (if not exists)
    NavigationItem.find_or_create_by!(href: "/settings/integrations/xero") do |nav|
      nav.name = "Xero"
      nav.icon = "RefreshCw"  # Sync icon - represents Xero sync
      nav.position = 0  # First child under Finance
      nav.parent_id = finance_nav.id
      nav.is_active = true
    end
  end

  def down
    NavigationItem.find_by(href: "/settings/integrations/xero")&.destroy
  end
end
