class RenameTrapidColumnsToTeeem < ActiveRecord::Migration[8.0]
  def change
    # Rename columns (only if they exist with old names)
    if column_exists?(:contacts, :trapid_rating)
      rename_column :contacts, :trapid_rating, :teeem_rating
    end

    if column_exists?(:feature_trackers, :trapid_has)
      rename_column :feature_trackers, :trapid_has, :teeem_has
    end

    # Rename index (only if it exists)
    if index_exists?(:contacts, :trapid_rating, name: 'index_contacts_on_trapid_rating')
      rename_index :contacts, 'index_contacts_on_trapid_rating', 'index_contacts_on_teeem_rating'
    end
  end
end
