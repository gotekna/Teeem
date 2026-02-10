class AddStorageBlobIdsToPricebooks < ActiveRecord::Migration[8.0]
  def change
    add_column :pricebooks, :image_storage_blob_id, :bigint
    add_column :pricebooks, :spec_storage_blob_id, :bigint
    add_column :pricebooks, :qr_code_storage_blob_id, :bigint

    add_index :pricebooks, :image_storage_blob_id
    add_index :pricebooks, :spec_storage_blob_id
    add_index :pricebooks, :qr_code_storage_blob_id

    add_foreign_key :pricebooks, :storage_blobs, column: :image_storage_blob_id
    add_foreign_key :pricebooks, :storage_blobs, column: :spec_storage_blob_id
    add_foreign_key :pricebooks, :storage_blobs, column: :qr_code_storage_blob_id
  end
end
