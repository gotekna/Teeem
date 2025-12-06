class CreateSmsMessages < ActiveRecord::Migration[8.0]
  def change
    create_table :sms_messages do |t|
      t.references :contact, null: false, foreign_key: true
      t.references :user, null: true, foreign_key: true # User who sent it (null for inbound)
      t.string :from_phone, null: false
      t.string :to_phone, null: false
      t.text :body, null: false
      t.string :direction, null: false # 'inbound' or 'outbound'
      t.string :status # 'queued', 'sent', 'delivered', 'failed', 'received'
      t.string :twilio_sid # Twilio message SID for tracking
      t.datetime :sent_at
      t.datetime :received_at
      t.text :error_message # If delivery failed

      t.timestamps
    end

    add_index :sms_messages, [ :contact_id, :created_at ]
    add_index :sms_messages, :twilio_sid, unique: true
    add_index :sms_messages, [ :direction, :status ]
  end
end
