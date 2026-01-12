class CreateEmailMailboxFavorites < ActiveRecord::Migration[8.0]
  def change
    create_table :email_mailbox_favorites do |t|
      t.references :user, null: false, foreign_key: true
      t.string :account_id, null: false

      t.timestamps
    end

    add_index :email_mailbox_favorites, [:user_id, :account_id], unique: true
  end
end
