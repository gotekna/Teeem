class AddSourceTypeToEmailWarehouse < ActiveRecord::Migration[8.0]
  def change
    add_column :email_warehouse, :source_type, :string, default: 'outlook'
    add_reference :email_warehouse, :imap_credential, null: true, foreign_key: true
    add_index :email_warehouse, :source_type
  end
end
