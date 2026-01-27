# frozen_string_literal: true

# Add IMAP support to SyncedEmailMailbox
#
# The Ultra Email Architecture also applies to IMAP:
# - Internal emails between IMAP users should be stored ONCE
# - Each user's mailbox gets a mailbox_appearance
#
# This adds imap_credential_id to track IMAP mailbox appearances
# and an index for fast lookups.
#
class AddImapToSyncedEmailMailboxes < ActiveRecord::Migration[7.0]
  def change
    add_reference :synced_email_mailboxes, :imap_credential, foreign_key: true, null: true

    # Fast lookup by IMAP credential
    add_index :synced_email_mailboxes, [:imap_credential_id, :mailbox_owner_email],
              name: 'idx_email_mailbox_imap_credential'

    # Add uid column for IMAP message UID (equivalent to outlook_id)
    add_column :synced_email_mailboxes, :uid, :bigint
  end
end
