# frozen_string_literal: true

# Data migration to sync legacy contact fields to SSoT tables
# This must run BEFORE RemoveLegacyContactFields migration
#
# Syncs:
#   contacts.email → contact_emails
#   contacts.mobile_phone → contact_phones (phone_type: 'mobile')
#   contacts.office_phone → contact_phones (phone_type: 'office')
#   contacts.fax_phone → contact_phones (phone_type: 'fax')
#
class SyncLegacyContactDataToSsot < ActiveRecord::Migration[8.0]
  def up
    # Sync emails: Insert into contact_emails for contacts that have legacy email but no SSoT email
    execute(<<~SQL)
      INSERT INTO contact_emails (contact_id, email, is_primary, position, created_at, updated_at)
      SELECT c.id, c.email, true, 0, NOW(), NOW()
      FROM contacts c
      WHERE c.email IS NOT NULL
        AND c.email != ''
        AND NOT EXISTS (
          SELECT 1 FROM contact_emails ce WHERE ce.contact_id = c.id
        )
    SQL

    emails_synced = connection.select_value("SELECT COUNT(*) FROM contact_emails WHERE created_at >= NOW() - INTERVAL '1 minute'")
    say "Synced #{emails_synced} emails to contact_emails table"

    # Sync mobile phones
    execute(<<~SQL)
      INSERT INTO contact_phones (contact_id, phone_number, phone_type, is_primary, position, created_at, updated_at)
      SELECT c.id, c.mobile_phone, 'mobile', true, 0, NOW(), NOW()
      FROM contacts c
      WHERE c.mobile_phone IS NOT NULL
        AND c.mobile_phone != ''
        AND NOT EXISTS (
          SELECT 1 FROM contact_phones cp WHERE cp.contact_id = c.id AND cp.phone_type = 'mobile'
        )
    SQL

    mobiles_synced = connection.select_value("SELECT COUNT(*) FROM contact_phones WHERE phone_type = 'mobile' AND created_at >= NOW() - INTERVAL '1 minute'")
    say "Synced #{mobiles_synced} mobile phones to contact_phones table"

    # Sync office phones
    execute(<<~SQL)
      INSERT INTO contact_phones (contact_id, phone_number, phone_type, is_primary, position, created_at, updated_at)
      SELECT c.id, c.office_phone, 'office',
        NOT EXISTS (SELECT 1 FROM contact_phones cp2 WHERE cp2.contact_id = c.id AND cp2.is_primary = true),
        COALESCE((SELECT MAX(cp3.position) FROM contact_phones cp3 WHERE cp3.contact_id = c.id), -1) + 1,
        NOW(), NOW()
      FROM contacts c
      WHERE c.office_phone IS NOT NULL
        AND c.office_phone != ''
        AND NOT EXISTS (
          SELECT 1 FROM contact_phones cp WHERE cp.contact_id = c.id AND cp.phone_type = 'office'
        )
    SQL

    office_synced = connection.select_value("SELECT COUNT(*) FROM contact_phones WHERE phone_type = 'office' AND created_at >= NOW() - INTERVAL '1 minute'")
    say "Synced #{office_synced} office phones to contact_phones table"

    # Sync fax phones
    execute(<<~SQL)
      INSERT INTO contact_phones (contact_id, phone_number, phone_type, is_primary, position, created_at, updated_at)
      SELECT c.id, c.fax_phone, 'fax',
        false,
        COALESCE((SELECT MAX(cp3.position) FROM contact_phones cp3 WHERE cp3.contact_id = c.id), -1) + 1,
        NOW(), NOW()
      FROM contacts c
      WHERE c.fax_phone IS NOT NULL
        AND c.fax_phone != ''
        AND NOT EXISTS (
          SELECT 1 FROM contact_phones cp WHERE cp.contact_id = c.id AND cp.phone_type = 'fax'
        )
    SQL

    fax_synced = connection.select_value("SELECT COUNT(*) FROM contact_phones WHERE phone_type = 'fax' AND created_at >= NOW() - INTERVAL '1 minute'")
    say "Synced #{fax_synced} fax numbers to contact_phones table"

    # Verify no orphans remain
    orphaned = connection.select_value(<<~SQL)
      SELECT COUNT(*) FROM contacts c
      WHERE (c.email IS NOT NULL AND c.email != '' AND NOT EXISTS (SELECT 1 FROM contact_emails ce WHERE ce.contact_id = c.id))
         OR (c.mobile_phone IS NOT NULL AND c.mobile_phone != '' AND NOT EXISTS (SELECT 1 FROM contact_phones cp WHERE cp.contact_id = c.id AND cp.phone_type = 'mobile'))
         OR (c.office_phone IS NOT NULL AND c.office_phone != '' AND NOT EXISTS (SELECT 1 FROM contact_phones cp WHERE cp.contact_id = c.id AND cp.phone_type = 'office'))
         OR (c.fax_phone IS NOT NULL AND c.fax_phone != '' AND NOT EXISTS (SELECT 1 FROM contact_phones cp WHERE cp.contact_id = c.id AND cp.phone_type = 'fax'))
    SQL

    if orphaned.to_i > 0
      raise "Migration incomplete: #{orphaned} contacts still have orphaned legacy data"
    end

    say "All legacy contact data synced to SSoT tables successfully"
  end

  def down
    # This migration only adds data, doesn't remove anything
    # Rollback would require knowing which records were added, which is complex
    # Since the legacy columns still exist, rollback is not strictly necessary
    say "Rollback not implemented - SSoT records will remain (legacy columns still exist)"
  end
end
