# frozen_string_literal: true

class AddSyncKeyToFoundationViews < ActiveRecord::Migration[7.2]
  def change
    add_column :foundation_views, :sync_key, :string
    add_column :foundation_views, :record_updated_at, :datetime

    add_index :foundation_views, [:tenant_id, :sync_key], unique: true, where: "sync_key IS NOT NULL",
              name: "index_foundation_views_on_tenant_sync_key"
  end
end
