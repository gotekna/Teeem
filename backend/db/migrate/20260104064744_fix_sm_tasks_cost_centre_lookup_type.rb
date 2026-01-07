# frozen_string_literal: true

# Fix type mismatch: Column metadata says "lookup" but DB has VARCHAR
# This column should be INTEGER to properly reference Cost Centre IDs
#
# Affected columns:
# - sm_tasks.cost_centre (lookup → cost_centres)
#
# Data check: Column has 0 records with data, safe to convert
class FixSmTasksCostCentreLookupType < ActiveRecord::Migration[8.0]
  def up
    # Convert VARCHAR to INTEGER for proper lookup functionality
    execute <<-SQL
      ALTER TABLE sm_tasks
      ALTER COLUMN cost_centre TYPE INTEGER
      USING NULLIF(cost_centre, '')::INTEGER;
    SQL
  end

  def down
    change_column :sm_tasks, :cost_centre, :string
  end
end
