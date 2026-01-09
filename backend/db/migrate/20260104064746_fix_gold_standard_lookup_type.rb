# frozen_string_literal: true

# Fix type mismatch: Column metadata says "lookup" but DB has VARCHAR
# This is a test table column, but should still be correctly typed
#
# Affected columns:
# - gold_standard_table.lookup (lookup → contacts)
#
# Data check: Column has 0 records with data, safe to convert
class FixGoldStandardLookupType < ActiveRecord::Migration[8.0]
  def up
    execute <<-SQL
      ALTER TABLE gold_standard_table
      ALTER COLUMN lookup TYPE INTEGER
      USING NULLIF(lookup, '')::INTEGER;
    SQL
  end

  def down
    change_column :gold_standard_table, :lookup, :string
  end
end
