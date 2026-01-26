# frozen_string_literal: true

class FixSettingsNavigationHref < ActiveRecord::Migration[8.0]
  def up
    # Fix Settings navigation item to point to /settings (not /settings/users)
    # The /settings page will redirect to /settings/profile (first tab)
    NavigationItem.where("href LIKE '/settings/%'")
                  .where("name ILIKE '%settings%' OR name ILIKE '%admin%'")
                  .update_all(href: "/settings")

    # Also directly fix any item that points to /settings/users
    NavigationItem.where(href: "/settings/users").update_all(href: "/settings")

    puts "Updated Settings navigation item href to /settings"
  end

  def down
    # No-op - leave as is
  end
end
