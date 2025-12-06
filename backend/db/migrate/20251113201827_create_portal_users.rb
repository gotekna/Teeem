class CreatePortalUsers < ActiveRecord::Migration[8.0]
  def change
    create_table :portal_users do |t|
      t.references :contact, null: false, foreign_key: true
      t.string :email, null: false
      t.string :password_digest, null: false
      t.string :portal_type, null: false  # 'supplier' or 'customer'
      t.boolean :active, default: true
      t.datetime :last_login_at
      t.string :reset_password_token
      t.datetime :reset_password_sent_at
      t.integer :failed_login_attempts, default: 0
      t.datetime :locked_until

      t.timestamps
    end

    add_index :portal_users, :email, unique: true
    add_index :portal_users, :reset_password_token, unique: true
    add_index :portal_users, [ :contact_id, :portal_type ], unique: true
  end
end
