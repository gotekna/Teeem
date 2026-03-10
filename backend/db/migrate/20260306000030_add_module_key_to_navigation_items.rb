# frozen_string_literal: true

class AddModuleKeyToNavigationItems < ActiveRecord::Migration[7.1]
  def up
    add_column :navigation_items, :module_key, :string

    # Map navigation hrefs to their module keys
    # Only items that belong to a toggleable module need a key
    module_mappings = {
      # Finance module
      "/finance" => "finance",
      "/purchase_orders" => "finance",
      "/estimates" => "finance",
      "/pricebook" => "finance",
      "/price-histories" => "finance",

      # Warehouse module
      "/warehouse" => "warehouse",
      "/docsort" => "docsort",

      # Corporate module
      "/corporate" => "corporate",
      "/cases" => "corporate",

      # Schedule Master module
      "/schedule" => "schedule_master",

      # Other toggleable modules
      "/properties" => "properties",
      "/calendar" => "calendar",
      "/meetings" => "meetings",
      "/esignature" => "esignature",
      "/library" => "library",
      "/portal" => "portal",
      "/leads" => "leads",
    }

    module_mappings.each do |href, module_key|
      execute <<-SQL
        UPDATE navigation_items SET module_key = '#{module_key}' WHERE href = '#{href}'
      SQL
    end
  end

  def down
    remove_column :navigation_items, :module_key
  end
end
