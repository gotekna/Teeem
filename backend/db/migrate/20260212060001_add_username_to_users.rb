class AddUsernameToUsers < ActiveRecord::Migration[8.0]
  def up
    add_column :users, :username, :string
    add_index :users, :username, unique: true, where: "username IS NOT NULL"

    # Pre-fill username from email for all existing users
    execute "UPDATE users SET username = email WHERE username IS NULL"
  end

  def down
    remove_column :users, :username
  end
end
