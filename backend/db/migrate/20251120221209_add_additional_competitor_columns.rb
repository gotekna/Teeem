class AddAdditionalCompetitorColumns < ActiveRecord::Migration[8.0]
  def change
    add_column :feature_trackers, :simpro_has, :boolean, default: false, null: false
    add_column :feature_trackers, :smarterbuild_has, :boolean, default: false, null: false
    add_column :feature_trackers, :clickhome_has, :boolean, default: false, null: false
  end
end
