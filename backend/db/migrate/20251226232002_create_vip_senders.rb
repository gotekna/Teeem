# frozen_string_literal: true

class CreateVipSenders < ActiveRecord::Migration[8.0]
  def change
    create_table :vip_senders do |t|
      t.references :user, null: false, foreign_key: true
      t.string :email_address, null: false
      t.string :name  # Display name for the VIP
      t.string :category  # "work", "personal", "client", etc.
      t.text :notes
      t.boolean :notify_immediately, default: true  # Push notification on new email

      t.timestamps
    end

    # Each user can only have one VIP entry per email address
    add_index :vip_senders, [:user_id, :email_address],
              unique: true,
              name: "idx_vip_senders_unique"

    # Fast lookup by email address (for checking incoming emails)
    add_index :vip_senders, :email_address,
              name: "idx_vip_senders_email"
  end
end
