class AddIsTeamContactToContacts < ActiveRecord::Migration[8.0]
  def change
    add_column :contacts, :is_team_contact, :boolean, default: false, null: false
    add_index :contacts, :is_team_contact
  end
end
