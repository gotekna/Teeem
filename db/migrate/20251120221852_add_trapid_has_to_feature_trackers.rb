class AddTrapidHasToFeatureTrackers < ActiveRecord::Migration[8.0]
  def change
    add_column :feature_trackers, :trapid_has, :boolean, default: false, null: false
  end
end
