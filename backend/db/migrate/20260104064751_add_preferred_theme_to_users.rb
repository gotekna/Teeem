class AddPreferredThemeToUsers < ActiveRecord::Migration[8.0]
  def up
    add_column :users, :preferred_theme, :string, default: 'light'

    # Set all existing users to light mode
    User.update_all(preferred_theme: 'light')

    # Set Jake to dark mode
    jake = User.find_by(email: 'jake@tekna.com.au')
    jake&.update!(preferred_theme: 'dark')
  end

  def down
    remove_column :users, :preferred_theme
  end
end
