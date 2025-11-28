class CreateUserOutlookCredentials < ActiveRecord::Migration[8.0]
  def change
    create_table :user_outlook_credentials, if_not_exists: true do |t|
      t.references :user, null: false, foreign_key: true, index: { unique: true }
      t.string :email
      t.text :access_token
      t.text :refresh_token
      t.datetime :expires_at
      t.string :tenant_id

      t.timestamps
    end
  end
end
