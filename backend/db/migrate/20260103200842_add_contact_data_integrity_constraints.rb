class AddContactDataIntegrityConstraints < ActiveRecord::Migration[8.0]
  # Data integrity constraints identified via Contact Ultra Audit
  # - entity_type must be NOT NULL and from allowed values
  # - Only one primary email/phone per contact (prevents race conditions)

  def up
    # Step 1: Backfill any NULL entity_type values (safety measure)
    # Infer type from existing data: if company_name_or_trust present and no first_name → company
    execute <<-SQL
      UPDATE contacts
      SET entity_type = CASE
        WHEN company_name_or_trust IS NOT NULL AND (first_name IS NULL OR first_name = '') THEN 'company'
        ELSE 'person'
      END
      WHERE entity_type IS NULL;
    SQL

    # Step 1b: Migrate legacy "team" entity_type to "person"
    # These are team contacts who are persons (have first_name, is_team_contact=true)
    execute "UPDATE contacts SET entity_type = 'person' WHERE entity_type = 'team';"

    # Step 2: Add NOT NULL constraint to entity_type
    change_column_null :contacts, :entity_type, false

    # Step 3: Add CHECK constraint for valid entity_type values
    execute <<-SQL
      ALTER TABLE contacts
      ADD CONSTRAINT check_contacts_entity_type
      CHECK (entity_type IN ('person', 'company', 'trust', 'sole_trader', 'price_only'));
    SQL

    # Step 4: Add unique partial index on contact_emails (only one primary per contact)
    # This prevents race conditions where two saves could both set is_primary=true
    execute <<-SQL
      CREATE UNIQUE INDEX IF NOT EXISTS idx_contact_emails_unique_primary
      ON contact_emails (contact_id)
      WHERE is_primary = true;
    SQL

    # Step 5: Add unique partial index on contact_phones (only one primary per contact)
    execute <<-SQL
      CREATE UNIQUE INDEX IF NOT EXISTS idx_contact_phones_unique_primary
      ON contact_phones (contact_id)
      WHERE is_primary = true;
    SQL
  end

  def down
    # Remove unique partial indexes
    execute "DROP INDEX IF EXISTS idx_contact_emails_unique_primary;"
    execute "DROP INDEX IF EXISTS idx_contact_phones_unique_primary;"

    # Remove CHECK constraint
    execute "ALTER TABLE contacts DROP CONSTRAINT IF EXISTS check_contacts_entity_type;"

    # Allow NULL again (not recommended)
    change_column_null :contacts, :entity_type, true
  end
end
