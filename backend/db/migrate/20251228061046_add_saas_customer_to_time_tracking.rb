class AddSaasCustomerToTimeTracking < ActiveRecord::Migration[8.0]
  def change
    # SitePresenceSession - where time is initially logged via site tracker
    add_column :site_presence_sessions, :saas_customer_id, :bigint
    add_index :site_presence_sessions, :saas_customer_id

    # LabourCostEntry - where cost is calculated (auto-created from SitePresenceSession)
    add_column :labour_cost_entries, :saas_customer_id, :bigint
    add_index :labour_cost_entries, :saas_customer_id
  end
end
