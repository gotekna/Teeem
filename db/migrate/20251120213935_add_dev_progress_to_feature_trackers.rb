class AddDevProgressToFeatureTrackers < ActiveRecord::Migration[8.0]
  def change
    add_column :feature_trackers, :dev_progress, :integer
  end
end
