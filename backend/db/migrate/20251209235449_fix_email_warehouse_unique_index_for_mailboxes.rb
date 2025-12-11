class FixEmailWarehouseUniqueIndexForMailboxes < ActiveRecord::Migration[8.0]
  def change
    # Remove old unique index on internet_message_id only
    remove_index :email_warehouse, name: "index_email_warehouse_on_internet_message_id", if_exists: true

    # Add composite unique index on (internet_message_id, mailbox_owner_email)
    # This allows the same email to exist in multiple mailboxes with different outlook_ids
    add_index :email_warehouse,
              [ :internet_message_id, :mailbox_owner_email ],
              unique: true,
              name: "index_email_warehouse_on_message_id_and_mailbox",
              if_not_exists: true

    # Keep non-unique index on internet_message_id for queries
    add_index :email_warehouse, :internet_message_id, if_not_exists: true
  end
end
