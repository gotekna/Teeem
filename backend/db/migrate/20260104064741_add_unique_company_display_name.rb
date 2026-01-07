# frozen_string_literal: true

# SSoT: Prevent duplicate company contacts
# This migration adds a unique partial index on display_name for active companies.
# Root Cause: Race condition in XeroContactSyncService allowed concurrent syncs to
# create duplicate contacts before xero_link was saved (5 "Joshua Braiden" duplicates).
class AddUniqueCompanyDisplayName < ActiveRecord::Migration[8.0]
  def up
    # Step 1: Clean up existing duplicates (keep oldest, deactivate others)
    # This runs before adding the constraint to ensure migration succeeds
    execute <<-SQL
      WITH duplicates AS (
        SELECT id,
               display_name,
               ROW_NUMBER() OVER (PARTITION BY LOWER(TRIM(display_name)) ORDER BY id) as rn
        FROM contacts
        WHERE entity_type = 'company' AND is_active = true
      )
      UPDATE contacts SET is_active = false
      WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);
    SQL

    # Step 2: Add unique partial index (only for active companies)
    # Uses LOWER(TRIM()) to prevent case/whitespace variations
    execute <<-SQL
      CREATE UNIQUE INDEX idx_contacts_unique_company_name
      ON contacts (LOWER(TRIM(display_name)))
      WHERE entity_type = 'company' AND is_active = true;
    SQL
  end

  def down
    execute "DROP INDEX IF EXISTS idx_contacts_unique_company_name;"
  end
end
