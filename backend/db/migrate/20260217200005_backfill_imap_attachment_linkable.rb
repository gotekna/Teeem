# frozen_string_literal: true

# FRC (Feb 2026): ImapEmailService#attach_email_files used documentable: instead of linkable:
# when creating WarehouseDocuments for IMAP email attachments. The attachment_documents query
# uses linkable_type/linkable_id (SSoT), so these records were invisible.
#
# This migration copies documentable → linkable for all affected records.
# After this, all email attachment WarehouseDocuments use linkable consistently.
class BackfillImapAttachmentLinkable < ActiveRecord::Migration[7.1]
  def up
    # Find email_attachment WarehouseDocuments that have documentable set but linkable missing
    updated = execute(<<~SQL).cmd_tuples
      UPDATE warehouse_documents
      SET linkable_type = documentable_type,
          linkable_id = documentable_id
      WHERE source_type = 'email_attachment'
        AND documentable_type = 'SyncedEmail'
        AND documentable_id IS NOT NULL
        AND (linkable_type IS NULL OR linkable_id IS NULL)
    SQL

    say "Backfilled linkable on #{updated} IMAP email attachment WarehouseDocuments"
  end

  def down
    # No-op: linkable is the correct field, no reason to revert
  end
end
