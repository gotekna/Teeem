class AddChapterIdToFeatureTrackers < ActiveRecord::Migration[8.0]
  def change
    # Allow null initially - will be populated by data migration
    add_reference :feature_trackers, :feature_chapter, null: true, foreign_key: true
  end
end
