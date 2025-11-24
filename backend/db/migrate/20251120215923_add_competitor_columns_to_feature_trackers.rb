class AddCompetitorColumnsToFeatureTrackers < ActiveRecord::Migration[8.0]
  def change
    add_column :feature_trackers, :buildertrend_has, :boolean, default: false, null: false
    add_column :feature_trackers, :coconstruct_has, :boolean, default: false, null: false
    add_column :feature_trackers, :procore_has, :boolean, default: false, null: false
    add_column :feature_trackers, :buildxact_has, :boolean, default: false, null: false
    add_column :feature_trackers, :jonas_has, :boolean, default: false, null: false
    add_column :feature_trackers, :houzz_has, :boolean, default: false, null: false
  end
end
