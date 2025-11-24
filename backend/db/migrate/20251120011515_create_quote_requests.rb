class CreateQuoteRequests < ActiveRecord::Migration[8.0]
  def change
    create_table :quote_requests do |t|
      t.references :construction, null: false, foreign_key: true
      t.references :created_by, null: false, foreign_key: { to_table: :users }
      t.string :title, null: false
      t.text :description
      t.string :trade_category
      t.date :requested_date
      t.decimal :budget_min, precision: 12, scale: 2
      t.decimal :budget_max, precision: 12, scale: 2
      t.string :status, null: false, default: 'draft'
      t.bigint :selected_quote_response_id
      t.jsonb :metadata, default: {}

      t.timestamps
    end

    add_index :quote_requests, :status
    add_index :quote_requests, :requested_date
    add_index :quote_requests, :trade_category
    add_index :quote_requests, [:construction_id, :status]
    add_index :quote_requests, :created_at
    add_index :quote_requests, :selected_quote_response_id
  end
end
