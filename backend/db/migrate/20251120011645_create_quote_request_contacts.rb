class CreateQuoteRequestContacts < ActiveRecord::Migration[8.0]
  def change
    create_table :quote_request_contacts do |t|
      t.references :quote_request, null: false, foreign_key: true
      t.references :contact, null: false, foreign_key: true
      t.datetime :notified_at
      t.string :notification_method
      t.jsonb :metadata, default: {}

      t.timestamps
    end

    add_index :quote_request_contacts, [:quote_request_id, :contact_id], unique: true, name: 'index_quote_request_contacts_unique'
    add_index :quote_request_contacts, :notified_at
  end
end
