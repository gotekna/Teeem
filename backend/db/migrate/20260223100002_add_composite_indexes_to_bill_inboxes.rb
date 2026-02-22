class AddCompositeIndexesToBillInboxes < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_index :bill_inboxes, [:tenant_id, :status], algorithm: :concurrently,
      name: "index_bill_inboxes_on_tenant_id_and_status",
      if_not_exists: true
    add_index :bill_inboxes, [:tenant_id, :match_status], algorithm: :concurrently,
      name: "index_bill_inboxes_on_tenant_id_and_match_status",
      if_not_exists: true
  end
end
