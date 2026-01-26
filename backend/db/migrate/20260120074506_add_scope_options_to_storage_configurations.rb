class AddScopeOptionsToStorageConfigurations < ActiveRecord::Migration[8.0]
  def change
    add_column :storage_configurations, :scope_options, :jsonb, default: {}, null: false
  end
end
