class AddVerifiedAtToStorageBlobs < ActiveRecord::Migration[8.0]
  def change
    add_column :storage_blobs, :verified_at, :datetime
    add_index :storage_blobs, :verified_at
  end
end
