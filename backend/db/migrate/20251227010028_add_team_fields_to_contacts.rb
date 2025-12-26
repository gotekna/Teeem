class AddTeamFieldsToContacts < ActiveRecord::Migration[8.0]
  def change
    add_column :contacts, :team_size, :integer
    add_column :contacts, :daily_rate_per_person, :decimal, precision: 10, scale: 2, default: 800.00
  end
end
