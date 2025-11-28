class AddDefaultSyncDirectionToSyncConfigurations < ActiveRecord::Migration[8.0]
  def change
    add_column :sync_configurations, :default_sync_direction, :string, default: 'import_only'
  end
end
