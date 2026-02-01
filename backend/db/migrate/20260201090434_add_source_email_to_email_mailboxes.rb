class AddSourceEmailToEmailMailboxes < ActiveRecord::Migration[8.0]
  def change
    add_column :email_mailboxes, :source_email, :string
  end
end
