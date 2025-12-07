class RenameFullNameToDisplayNameInContacts < ActiveRecord::Migration[8.0]
  def change
    # Rename the actual database column from full_name to display_name
    # This is the SSoT change - all code must reference display_name going forward
    rename_column :contacts, :full_name, :display_name
  end
end
