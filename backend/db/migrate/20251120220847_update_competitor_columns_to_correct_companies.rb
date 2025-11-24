class UpdateCompetitorColumnsToCorrectCompanies < ActiveRecord::Migration[8.0]
  def change
    # Remove old competitor columns
    remove_column :feature_trackers, :coconstruct_has, :boolean
    remove_column :feature_trackers, :procore_has, :boolean
    remove_column :feature_trackers, :jonas_has, :boolean
    remove_column :feature_trackers, :houzz_has, :boolean

    # Rename buildertrend_has to buildertrend_has (keep it)
    # Rename buildxact_has to buildexact_has
    rename_column :feature_trackers, :buildxact_has, :buildexact_has

    # Add new competitor columns
    add_column :feature_trackers, :jacks_has, :boolean, default: false, null: false
    add_column :feature_trackers, :wunderbuilt_has, :boolean, default: false, null: false
    add_column :feature_trackers, :databuild_has, :boolean, default: false, null: false
  end
end
