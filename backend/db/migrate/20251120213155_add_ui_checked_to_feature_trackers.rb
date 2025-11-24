class AddUiCheckedToFeatureTrackers < ActiveRecord::Migration[8.0]
  def change
    add_column :feature_trackers, :ui_checked, :boolean, default: false, null: false
  end
end
