class AddEmailNavPositionsToUsers < ActiveRecord::Migration[8.0]
  def change
    add_column :users, :email_nav_positions, :jsonb, default: {}
  end
end
