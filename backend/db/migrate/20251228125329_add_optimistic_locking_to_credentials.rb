class AddOptimisticLockingToCredentials < ActiveRecord::Migration[8.0]
  def change
    # Optimistic locking prevents concurrent updates from silently overwriting each other
    # Rails automatically uses lock_version column for optimistic locking
    # If two processes try to update the same record, the second will raise
    # ActiveRecord::StaleObjectError instead of silently overwriting changes

    # Microsoft credentials - used for token refresh across multiple workers
    add_column :microsoft_credentials, :lock_version, :integer, default: 0, null: false

    # Xero credentials - used for token refresh and webhook processing
    add_column :xero_credentials, :lock_version, :integer, default: 0, null: false
  end
end
