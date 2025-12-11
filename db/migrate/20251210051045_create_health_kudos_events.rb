# frozen_string_literal: true

class CreateHealthKudosEvents < ActiveRecord::Migration[8.0]
  def change
    create_table :health_kudos_events do |t|
      # Who fixed it - 'system' for auto-fix, or user_id
      t.string :actor_type, null: false, default: 'user' # 'system' or 'user'
      t.bigint :user_id # null for system fixes

      # What was fixed
      t.string :action, null: false # 'auto_fix', 'manual_fix', 'prevention_added'
      t.string :fix_type, null: false # 'name_casing', 'website_prefix', 'phone_format', etc.
      t.string :record_type # 'Contact', 'CorporateCompany', etc.
      t.bigint :record_id
      t.integer :records_fixed, default: 1 # For bulk fixes

      # Points
      t.integer :points, null: false, default: 0

      # Details
      t.jsonb :details, default: {} # Original values, new values, etc.
      t.string :description # Human-readable description

      t.timestamps

      t.index :actor_type
      t.index :user_id
      t.index :action
      t.index :fix_type
      t.index [ :record_type, :record_id ]
      t.index :created_at
    end

    # Add foreign key only if users table exists
    add_foreign_key :health_kudos_events, :users, on_delete: :nullify if table_exists?(:users)
  end
end
