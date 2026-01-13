class AddConfigLinksToStorageConfiguration < ActiveRecord::Migration[8.0]
  def change
    # SSoT: Stores config link URLs per scope
    # Format: { "contact": "/admin/system/entity-config/contact", "job": "/admin/system/entity-config/job" }
    add_column :storage_configurations, :config_links, :jsonb, null: false, default: {}
  end
end
