class CreateUserMicrosoftTokens < ActiveRecord::Migration[8.0]
  def change
    create_table :user_microsoft_tokens do |t|
      t.references :user, null: false, foreign_key: true
      t.text :access_token
      t.text :refresh_token
      t.datetime :token_expires_at
      t.text :scopes
      t.string :email
      t.string :status, default: 'pending'
      t.datetime :last_sync_at
      t.text :sync_error

      t.timestamps
    end

    add_index :user_microsoft_tokens, :email
    add_index :user_microsoft_tokens, :status
  end
end
