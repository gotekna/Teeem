class CreatePortalUsers < ActiveRecord::Migration[7.1]
  def change
    create_table :portal_users do |t|
      t.bigint :tenant_id, null: false
      t.string :email, null: false
      t.string :password_digest, null: false
      t.string :name, null: false
      t.string :phone
      t.string :portal_role, null: false, default: "tenant"
      t.references :contact, foreign_key: true, null: true
      t.datetime :last_login_at
      t.integer :login_count, default: 0
      t.string :reset_token
      t.datetime :reset_token_expires_at
      t.boolean :active, default: true

      t.timestamps
    end

    add_index :portal_users, :tenant_id
    add_index :portal_users, [:email, :tenant_id], unique: true, name: "idx_portal_users_email_tenant"
    add_index :portal_users, :portal_role
    add_index :portal_users, :reset_token, unique: true, where: "reset_token IS NOT NULL"
  end
end
