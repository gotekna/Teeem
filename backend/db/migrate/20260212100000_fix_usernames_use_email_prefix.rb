class FixUsernamesUseEmailPrefix < ActiveRecord::Migration[8.0]
  def up
    # Revert: username defaults to full email address, users can change it later
    execute "UPDATE users SET username = email WHERE email IS NOT NULL"
  end

  def down
    # no-op
  end
end
