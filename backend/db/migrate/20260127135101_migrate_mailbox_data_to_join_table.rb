# frozen_string_literal: true

# Data migration: Populate synced_email_mailboxes from existing synced_emails
#
# This migrates the existing mailbox data (mailbox_owner_email, outlook_id, folder_name, is_read)
# from the synced_emails table into the new synced_email_mailboxes join table.
#
# Why: Ultra Email Architecture - Store Once, Link Many
# Previously, same email sent to multiple recipients created duplicate records.
# Now we store content once and link to multiple mailboxes via join table.
#
# Safety:
# - Uses INSERT ... ON CONFLICT DO NOTHING (idempotent)
# - Does NOT delete or modify synced_emails columns (backward compat)
# - Can be re-run safely if needed
#
class MigrateMailboxDataToJoinTable < ActiveRecord::Migration[7.0]
  def up
    say_with_time "Migrating mailbox data from synced_emails to synced_email_mailboxes" do
      # Count existing records for progress reporting
      total = execute("SELECT COUNT(*) FROM synced_emails WHERE mailbox_owner_email IS NOT NULL").first["count"]
      say "Found #{total} synced_emails with mailbox_owner_email to migrate"

      # Migrate in batches to avoid memory issues on large datasets
      batch_size = 10_000
      migrated = 0

      loop do
        # Handle orphaned microsoft_credential_id by only including valid credential IDs
        # LEFT JOIN ensures we get all emails, setting credential to NULL if missing
        result = execute(<<-SQL.squish)
          INSERT INTO synced_email_mailboxes
            (synced_email_id, mailbox_owner_email, outlook_id, folder_name, is_read,
             microsoft_credential_id, labels, created_at, updated_at)
          SELECT
            se.id,
            LOWER(se.mailbox_owner_email),
            se.outlook_id,
            se.folder_name,
            COALESCE(se.is_read, false),
            mc.id,
            '[]'::jsonb,
            COALESCE(se.first_synced_at, se.created_at, NOW()),
            NOW()
          FROM synced_emails se
          LEFT JOIN microsoft_credentials mc ON mc.id = se.microsoft_credential_id
          WHERE se.mailbox_owner_email IS NOT NULL
            AND se.id NOT IN (SELECT synced_email_id FROM synced_email_mailboxes)
          LIMIT #{batch_size}
          ON CONFLICT (synced_email_id, mailbox_owner_email) DO NOTHING
        SQL

        rows_affected = result.cmd_tuples rescue 0
        migrated += rows_affected

        say "  Migrated #{migrated} of #{total} records..." if migrated % 50_000 == 0 && migrated > 0

        break if rows_affected == 0 || rows_affected < batch_size
      end

      say "Migration complete: #{migrated} mailbox appearances created"
      migrated
    end
  end

  def down
    # Data migration is one-way - we don't delete the join table records on rollback
    # because the synced_emails columns still have the data (backward compat)
    say "Down migration: Not deleting synced_email_mailboxes (data preserved in synced_emails)"
  end
end
