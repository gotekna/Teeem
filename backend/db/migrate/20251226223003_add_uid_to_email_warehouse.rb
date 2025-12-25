class AddUidToEmailWarehouse < ActiveRecord::Migration[8.0]
  def change
    add_column :email_warehouse, :uid, :bigint
    add_index :email_warehouse, [:imap_credential_id, :uid], name: 'idx_email_warehouse_imap_uid', where: 'uid IS NOT NULL'
  end
end
