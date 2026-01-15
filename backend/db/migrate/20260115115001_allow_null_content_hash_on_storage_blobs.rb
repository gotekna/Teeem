class AllowNullContentHashOnStorageBlobs < ActiveRecord::Migration[7.1]
  def change
    # Allow NULL for content_hash to support legacy records migrated without download
    # New uploads still compute content_hash for deduplication
    change_column_null :storage_blobs, :content_hash, true
  end
end
