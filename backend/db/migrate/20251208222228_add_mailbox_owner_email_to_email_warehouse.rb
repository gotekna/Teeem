class AddMailboxOwnerEmailToEmailWarehouse < ActiveRecord::Migration[8.0]
  def change
    add_column :email_warehouses, :mailbox_owner_email, :string
    add_index :email_warehouses, :mailbox_owner_email
  end
end
