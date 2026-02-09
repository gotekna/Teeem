class AddIsMailboxToBaseFolders < ActiveRecord::Migration[8.0]
  def change
    add_column :base_folders, :is_mailbox, :boolean, default: false, null: false
  end
end
