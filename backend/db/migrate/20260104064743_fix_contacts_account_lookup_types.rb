# frozen_string_literal: true

# Fix type mismatch: Column metadata says "lookup" but DB has VARCHAR
# These columns should be INTEGER to properly reference Xero Account IDs
#
# Affected columns:
# - contacts.default_purchase_account (lookup → xero_accounts)
# - contacts.default_sales_account (lookup → xero_accounts)
#
# Data check: Both columns have 0 records with data, safe to convert
class FixContactsAccountLookupTypes < ActiveRecord::Migration[8.0]
  def up
    # Convert VARCHAR to INTEGER for proper lookup functionality
    # Using raw SQL to handle the type change cleanly

    # default_purchase_account: varchar → integer
    execute <<-SQL
      ALTER TABLE contacts
      ALTER COLUMN default_purchase_account TYPE INTEGER
      USING NULLIF(default_purchase_account, '')::INTEGER;
    SQL

    # default_sales_account: varchar → integer
    execute <<-SQL
      ALTER TABLE contacts
      ALTER COLUMN default_sales_account TYPE INTEGER
      USING NULLIF(default_sales_account, '')::INTEGER;
    SQL
  end

  def down
    # Revert back to varchar
    change_column :contacts, :default_purchase_account, :string
    change_column :contacts, :default_sales_account, :string
  end
end
