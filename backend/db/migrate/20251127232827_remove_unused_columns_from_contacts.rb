class RemoveUnusedColumnsFromContacts < ActiveRecord::Migration[8.0]
  def change
    # Remove columns that are not used anywhere in the codebase
    # Verified through grep search - no references in models, controllers, views, or services

    # Portal-related (never implemented)
    remove_column :contacts, :portal_welcome_sent_at, :datetime

    # Identity document fields (not used - compliance uses separate document system)
    remove_column :contacts, :drivers_license_number, :string
    remove_column :contacts, :passport_number, :string

    # Birth location fields (not used anywhere)
    remove_column :contacts, :place_of_birth, :string
    remove_column :contacts, :birth_state, :string
    remove_column :contacts, :birth_country, :string

    # Address field (duplicates address_line_1/2 system)
    remove_column :contacts, :current_residential_address, :text
  end
end
