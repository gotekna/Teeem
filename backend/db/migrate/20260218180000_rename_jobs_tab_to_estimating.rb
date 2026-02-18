# frozen_string_literal: true

# Rename the "Jobs" primary nav tab to "Estimating" for all tenants.
class RenameJobsTabToEstimating < ActiveRecord::Migration[7.2]
  def up
    execute(<<-SQL.squish)
      UPDATE warehouse_folders
      SET name = 'Estimating', display_name = 'Estimating', updated_at = NOW()
      WHERE tab_key = 'jobs'
    SQL
    puts "  ✅ Renamed 'Jobs' tab to 'Estimating'"
  end

  def down
    execute(<<-SQL.squish)
      UPDATE warehouse_folders
      SET name = 'Jobs', display_name = 'Jobs', updated_at = NOW()
      WHERE tab_key = 'jobs'
    SQL
  end
end