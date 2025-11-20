class AddClickupToFeatureTrackers < ActiveRecord::Migration[8.0]
  def change
    add_column :feature_trackers, :clickup_has, :boolean
  end
end
