class CreateEmailAliases < ActiveRecord::Migration[8.0]
  def change
    create_table :email_aliases do |t|
      t.references :email_subscription, null: false, foreign_key: true
      t.string :alias_address, null: false  # e.g., "*" for catch-all, "info", "sales"
      t.string :target_address, null: false # e.g., "rob@100xbestlife.com"
      t.string :alias_type, default: "alias" # "alias" or "catchall"
      t.boolean :is_active, default: true
      t.string :polaris_alias_id   # ID from PolarisMail if applicable
      t.datetime :provisioned_at
      t.timestamps
    end

    add_index :email_aliases, [:email_subscription_id, :alias_address], unique: true
  end
end
