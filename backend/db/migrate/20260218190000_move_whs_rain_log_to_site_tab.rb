# frozen_string_literal: true

# Move WHS and Rain Log sub-tabs from Estimating (jobs) to Site primary tab.
class MoveWHSRainLogToSiteTab < ActiveRecord::Migration[7.2]
  def up
    ActsAsTenant.without_tenant do
      site_tab = WarehouseFolder.find_by(tab_key: "site", parent_id: nil)
      unless site_tab
        puts "  ⚠️  No top-level 'site' tab found - skipping"
        return
      end

      execute(<<-SQL.squish)
        UPDATE warehouse_folders
        SET parent_id = #{site_tab.id}, order_position = 4, updated_at = NOW()
        WHERE tab_key = 'whs'
      SQL

      execute(<<-SQL.squish)
        UPDATE warehouse_folders
        SET parent_id = #{site_tab.id}, order_position = 5, updated_at = NOW()
        WHERE tab_key = 'rain-log'
      SQL

      puts "  ✅ Moved WHS and Rain Log to Site tab (id=#{site_tab.id})"
    end
  end

  def down
    ActsAsTenant.without_tenant do
      estimating_tab = WarehouseFolder.find_by(tab_key: "jobs")
      return unless estimating_tab

      execute(<<-SQL.squish)
        UPDATE warehouse_folders
        SET parent_id = #{estimating_tab.id}, order_position = 4, updated_at = NOW()
        WHERE tab_key = 'whs'
      SQL

      execute(<<-SQL.squish)
        UPDATE warehouse_folders
        SET parent_id = #{estimating_tab.id}, order_position = 5, updated_at = NOW()
        WHERE tab_key = 'rain-log'
      SQL
    end
  end
end