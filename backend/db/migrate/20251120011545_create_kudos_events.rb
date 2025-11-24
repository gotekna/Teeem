class CreateKudosEvents < ActiveRecord::Migration[8.0]
  def change
    create_table :kudos_events do |t|
      t.references :subcontractor_account, null: false, foreign_key: true
      t.references :quote_response, null: true, foreign_key: true
      t.references :purchase_order, null: true, foreign_key: true
      t.string :event_type, null: false
      t.datetime :expected_time
      t.datetime :actual_time
      t.decimal :points_awarded, precision: 10, scale: 2, default: 0.0
      t.jsonb :metadata, default: {}

      t.timestamps
    end

    add_index :kudos_events, :event_type
    add_index :kudos_events, [:subcontractor_account_id, :event_type]
    add_index :kudos_events, :created_at
  end
end
