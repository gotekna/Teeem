class AddNeedsEnrichmentToSyncedEmails < ActiveRecord::Migration[8.0]
  def change
    add_column :synced_emails, :needs_enrichment, :boolean, default: false

    # Partial index - only index rows that need enrichment (sparse, fast lookups)
    add_index :synced_emails, :needs_enrichment,
              where: "needs_enrichment = true",
              name: "idx_synced_emails_needs_enrichment"

    # Required for upsert_all: unique constraint on (internet_message_id, tenant_id)
    # The existing idx_email_warehouse_internet_message_id is non-unique.
    # Model validates uniqueness: { scope: :tenant_id } but upsert_all needs a DB constraint.
    #
    # Step 1: Deduplicate - keep the most recently synced row for each (internet_message_id, tenant_id)
    # Must also clean up FK references (mailbox appearances, recipients, etc.)
    reversible do |dir|
      dir.up do
        # Identify IDs to keep (most recently synced per internet_message_id + tenant_id)
        # Delete dependent records for duplicates, then delete the duplicate emails
        execute <<~SQL
          WITH keep_ids AS (
            SELECT DISTINCT ON (internet_message_id, tenant_id) id
            FROM synced_emails
            ORDER BY internet_message_id, tenant_id, last_synced_at DESC NULLS LAST, id DESC
          ),
          dupe_ids AS (
            SELECT se.id
            FROM synced_emails se
            WHERE se.id NOT IN (SELECT id FROM keep_ids)
            AND se.internet_message_id IN (
              SELECT internet_message_id
              FROM synced_emails
              GROUP BY internet_message_id, tenant_id
              HAVING COUNT(*) > 1
            )
          )
          -- Step 1a: Delete mailbox appearances for duplicates
          DELETE FROM synced_email_mailboxes
          WHERE synced_email_id IN (SELECT id FROM dupe_ids)
        SQL

        execute <<~SQL
          WITH keep_ids AS (
            SELECT DISTINCT ON (internet_message_id, tenant_id) id
            FROM synced_emails
            ORDER BY internet_message_id, tenant_id, last_synced_at DESC NULLS LAST, id DESC
          ),
          dupe_ids AS (
            SELECT se.id
            FROM synced_emails se
            WHERE se.id NOT IN (SELECT id FROM keep_ids)
            AND se.internet_message_id IN (
              SELECT internet_message_id
              FROM synced_emails
              GROUP BY internet_message_id, tenant_id
              HAVING COUNT(*) > 1
            )
          )
          -- Step 1b: Delete email recipients for duplicates
          DELETE FROM email_recipients
          WHERE email_warehouse_id IN (SELECT id FROM dupe_ids)
        SQL

        execute <<~SQL
          WITH keep_ids AS (
            SELECT DISTINCT ON (internet_message_id, tenant_id) id
            FROM synced_emails
            ORDER BY internet_message_id, tenant_id, last_synced_at DESC NULLS LAST, id DESC
          ),
          dupe_ids AS (
            SELECT se.id
            FROM synced_emails se
            WHERE se.id NOT IN (SELECT id FROM keep_ids)
            AND se.internet_message_id IN (
              SELECT internet_message_id
              FROM synced_emails
              GROUP BY internet_message_id, tenant_id
              HAVING COUNT(*) > 1
            )
          )
          -- Step 1c: Delete email user states for duplicates
          DELETE FROM email_user_states
          WHERE email_warehouse_id IN (SELECT id FROM dupe_ids)
        SQL

        execute <<~SQL
          WITH keep_ids AS (
            SELECT DISTINCT ON (internet_message_id, tenant_id) id
            FROM synced_emails
            ORDER BY internet_message_id, tenant_id, last_synced_at DESC NULLS LAST, id DESC
          ),
          dupe_ids AS (
            SELECT se.id
            FROM synced_emails se
            WHERE se.id NOT IN (SELECT id FROM keep_ids)
            AND se.internet_message_id IN (
              SELECT internet_message_id
              FROM synced_emails
              GROUP BY internet_message_id, tenant_id
              HAVING COUNT(*) > 1
            )
          )
          -- Step 1d: Delete email label assignments for duplicates
          DELETE FROM email_label_assignments
          WHERE email_warehouse_id IN (SELECT id FROM dupe_ids)
        SQL

        execute <<~SQL
          WITH keep_ids AS (
            SELECT DISTINCT ON (internet_message_id, tenant_id) id
            FROM synced_emails
            ORDER BY internet_message_id, tenant_id, last_synced_at DESC NULLS LAST, id DESC
          ),
          dupe_ids AS (
            SELECT se.id
            FROM synced_emails se
            WHERE se.id NOT IN (SELECT id FROM keep_ids)
            AND se.internet_message_id IN (
              SELECT internet_message_id
              FROM synced_emails
              GROUP BY internet_message_id, tenant_id
              HAVING COUNT(*) > 1
            )
          )
          -- Step 1e: Delete task attachments for duplicates
          DELETE FROM sm_task_attachments
          WHERE attachable_type = 'SyncedEmail'
          AND attachable_id IN (SELECT id FROM dupe_ids)
        SQL

        execute <<~SQL
          WITH keep_ids AS (
            SELECT DISTINCT ON (internet_message_id, tenant_id) id
            FROM synced_emails
            ORDER BY internet_message_id, tenant_id, last_synced_at DESC NULLS LAST, id DESC
          ),
          dupe_ids AS (
            SELECT se.id
            FROM synced_emails se
            WHERE se.id NOT IN (SELECT id FROM keep_ids)
            AND se.internet_message_id IN (
              SELECT internet_message_id
              FROM synced_emails
              GROUP BY internet_message_id, tenant_id
              HAVING COUNT(*) > 1
            )
          )
          -- Step 1f: Delete email snoozes for duplicates
          DELETE FROM email_snoozes
          WHERE email_warehouse_id IN (SELECT id FROM dupe_ids)
        SQL

        execute <<~SQL
          WITH keep_ids AS (
            SELECT DISTINCT ON (internet_message_id, tenant_id) id
            FROM synced_emails
            ORDER BY internet_message_id, tenant_id, last_synced_at DESC NULLS LAST, id DESC
          ),
          dupe_ids AS (
            SELECT se.id
            FROM synced_emails se
            WHERE se.id NOT IN (SELECT id FROM keep_ids)
            AND se.internet_message_id IN (
              SELECT internet_message_id
              FROM synced_emails
              GROUP BY internet_message_id, tenant_id
              HAVING COUNT(*) > 1
            )
          )
          -- Step 1g: Delete warehouse documents for duplicates
          DELETE FROM warehouse_documents
          WHERE documentable_type = 'SyncedEmail'
          AND documentable_id IN (SELECT id FROM dupe_ids)
        SQL

        # Step 2: Now delete the duplicate emails themselves
        execute <<~SQL
          WITH keep_ids AS (
            SELECT DISTINCT ON (internet_message_id, tenant_id) id
            FROM synced_emails
            ORDER BY internet_message_id, tenant_id, last_synced_at DESC NULLS LAST, id DESC
          )
          DELETE FROM synced_emails
          WHERE id NOT IN (SELECT id FROM keep_ids)
          AND internet_message_id IN (
            SELECT internet_message_id
            FROM synced_emails
            GROUP BY internet_message_id, tenant_id
            HAVING COUNT(*) > 1
          )
        SQL
      end
    end

    # Step 3: Now safe to create unique index
    add_index :synced_emails, [:internet_message_id, :tenant_id],
              unique: true,
              name: "idx_synced_emails_message_id_tenant"
  end
end
