class CreateEmailRecipients < ActiveRecord::Migration[8.0]
  def change
    create_table :email_recipients do |t|
      t.references :email_warehouse, null: false, foreign_key: { to_table: :email_warehouse }
      t.references :user, foreign_key: true  # Internal user (nullable)
      t.references :contact, foreign_key: true  # External contact (nullable)
      t.string :email_address, null: false
      t.string :recipient_type, null: false  # 'from', 'to', 'cc', 'bcc'
      t.boolean :is_internal, default: false
      t.timestamps

      t.index [ :email_warehouse_id, :email_address ], unique: true, name: 'idx_email_recipients_unique'
      t.index :recipient_type
      t.index :is_internal
    end
  end
end
