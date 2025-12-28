# Performance: Index for duplicate email checking
# 70+ slow queries per day looking up by internet_message_id
class AddInternetMessageIdIndexToEmailWarehouse < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_index :email_warehouse, :internet_message_id,
              name: "idx_email_warehouse_internet_message_id",
              algorithm: :concurrently,
              if_not_exists: true
  end
end
