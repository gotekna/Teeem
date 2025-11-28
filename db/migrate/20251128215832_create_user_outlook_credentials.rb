class CreateUserOutlookCredentials < ActiveRecord::Migration[8.0]
  def change
    create_table :user_outlook_credentials do |t|
      t.references :user, null: false, foreign_key: true
      t.string :email
      t.text :access_token
      t.text :refresh_token
      t.datetime :expires_at
      t.string :tenant_id

      t.timestamps
    end

    add_index :user_outlook_credentials, :user_id, unique: true
  end
end
