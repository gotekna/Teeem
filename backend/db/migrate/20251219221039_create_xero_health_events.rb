class CreateXeroHealthEvents < ActiveRecord::Migration[8.0]
  def change
    create_table :xero_health_events do |t|
      t.references :xero_credential, null: true, foreign_key: true
      t.string :event_type, null: false
      t.string :from_status
      t.string :to_status
      t.string :trigger
      t.text :message
      t.jsonb :metadata, default: {}

      t.timestamps
    end

    # Index for querying events by credential
    add_index :xero_health_events, [:xero_credential_id, :created_at]
    # Index for querying events by type
    add_index :xero_health_events, [:event_type, :created_at]
    # Index for querying status transitions
    add_index :xero_health_events, [:from_status, :to_status]
  end
end
