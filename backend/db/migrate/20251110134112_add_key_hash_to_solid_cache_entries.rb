class AddKeyHashToSolidCacheEntries < ActiveRecord::Migration[8.0]
  def change
    # No-op: key_hash column is now created in CreateSolidCacheEntries migration
    # This migration kept for migration history consistency
  end
end
