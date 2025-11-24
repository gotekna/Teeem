class CreateQuoteResponses < ActiveRecord::Migration[8.0]
  def change
    create_table :quote_responses do |t|
      t.references :quote_request, null: false, foreign_key: true
      t.references :contact, null: false, foreign_key: true
      t.references :responded_by_portal_user, null: true, foreign_key: { to_table: :portal_users }
      t.decimal :price, precision: 12, scale: 2, null: false
      t.string :timeframe
      t.text :notes
      t.string :status, null: false, default: 'pending'
      t.datetime :submitted_at
      t.datetime :decision_at
      t.jsonb :metadata, default: {}

      t.timestamps
    end

    add_index :quote_responses, :status
    add_index :quote_responses, [:quote_request_id, :status]
    add_index :quote_responses, [:contact_id, :status]
    add_index :quote_responses, :submitted_at
    add_index :quote_responses, :created_at
  end
end
