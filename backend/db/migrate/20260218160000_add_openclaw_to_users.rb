class AddOpenclawToUsers < ActiveRecord::Migration[7.2]
  def change
    add_column :users, :openclaw_api_key_digest, :string
    add_column :users, :openclaw_api_key_last4, :string
    add_column :users, :openclaw_permissions, :jsonb, default: {
      "chat" => false,
      "notes" => false,
      "job_updates" => false,
      "contacts" => false
    }
    add_column :users, :openclaw_api_key_created_at, :datetime

    add_index :users, :openclaw_api_key_digest, unique: true,
              where: "openclaw_api_key_digest IS NOT NULL",
              name: "index_users_on_openclaw_api_key_digest"
  end
end
