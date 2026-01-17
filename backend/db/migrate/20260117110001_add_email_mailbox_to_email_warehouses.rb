# frozen_string_literal: true

# Phase 4: Virtual File Warehouse
# Add FK from EmailWarehouse to EmailMailbox for virtual folder organization.
# This enables grouping emails by mailbox in the virtual folder structure:
# Emails/{{Mailbox}}/Email Body/{{Year}}/{{Month}}
class AddEmailMailboxToEmailWarehouses < ActiveRecord::Migration[7.1]
  def change
    add_reference :email_warehouses, :email_mailbox,
                  foreign_key: true,
                  null: true,
                  index: true
  end
end
