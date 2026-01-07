# frozen_string_literal: true

# Fix type mismatch: Column metadata says "lookup" but DB has VARCHAR
# These columns should be INTEGER to properly reference IDs
#
# Affected columns:
# - sm_schedule_masters.cost_centre (lookup → cost_centres) - 0 records with data
# - sm_schedule_masters.header_gantt (lookup → sm-schedule-master self-reference) - 242 records with data
#
# Data conversion: header_gantt stores string IDs like "1407" that will be converted to integers
class FixSmScheduleMasterLookupTypes < ActiveRecord::Migration[8.0]
  def up
    # cost_centre: varchar → integer (no data, safe conversion)
    execute <<-SQL
      ALTER TABLE sm_schedule_masters
      ALTER COLUMN cost_centre TYPE INTEGER
      USING NULLIF(cost_centre, '')::INTEGER;
    SQL

    # header_gantt: varchar → integer (has 242 records with string IDs like "1407")
    # NULLIF handles empty strings, ::INTEGER converts "1407" to 1407
    execute <<-SQL
      ALTER TABLE sm_schedule_masters
      ALTER COLUMN header_gantt TYPE INTEGER
      USING NULLIF(header_gantt, '')::INTEGER;
    SQL
  end

  def down
    change_column :sm_schedule_masters, :cost_centre, :string
    change_column :sm_schedule_masters, :header_gantt, :string
  end
end
