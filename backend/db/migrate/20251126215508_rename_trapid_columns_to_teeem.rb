class RenameTrapidColumnsToTeeem < ActiveRecord::Migration[8.0]
  def change
    # Rename columns
    rename_column :contacts, :trapid_rating, :teeem_rating
    rename_column :feature_trackers, :trapid_has, :teeem_has

    # Rename index
    rename_index :contacts, 'index_contacts_on_trapid_rating', 'index_contacts_on_teeem_rating'
  end
end
