# Phase 4 of Xero SSoT Architecture: Remove deprecated connection_status column
#
# This column was deprecated because it created an SSoT violation:
# - XeroCredential.effectively_connected? showed one status
# - CorporateCompanyXeroConnection.connection_status showed a different status
#
# The new SSoT is XeroConnectionHealth.for_credential() which computes
# status in real-time from the actual token state.
#
# This migration is REVERSIBLE in case we need to rollback.
#
class RemoveConnectionStatusFromCorporateCompanyXeroConnections < ActiveRecord::Migration[8.0]
  def up
    # Remove the deprecated column
    remove_column :corporate_xero_connections, :connection_status, :string

    # Also remove the deprecated last_sync_error column (status now in XeroHealthEvent)
    remove_column :corporate_xero_connections, :last_sync_error, :text
  end

  def down
    # Re-add the columns if rolling back
    add_column :corporate_xero_connections, :connection_status, :string, default: "pending"
    add_column :corporate_xero_connections, :last_sync_error, :text

    # Backfill status from XeroConnectionHealth
    CorporateCompanyXeroConnection.find_each do |conn|
      health = conn.health_status
      conn.update_columns(
        connection_status: health.connected ? "connected" : "disconnected"
      )
    end
  end
end
