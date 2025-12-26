# frozen_string_literal: true

class CreateGlPeriodLocks < ActiveRecord::Migration[7.1]
  def change
    create_table :gl_period_locks do |t|
      t.references :corporate_company, null: false, foreign_key: true
      t.references :locked_by, foreign_key: { to_table: :users }
      t.references :unlocked_by, foreign_key: { to_table: :users }

      # Lock period
      t.date :period_start, null: false
      t.date :period_end, null: false
      t.string :period_type, null: false, limit: 20  # month, quarter, year

      # Status
      t.string :status, null: false, default: "locked", limit: 20  # locked, unlocked, soft_locked
      t.datetime :locked_at
      t.datetime :unlocked_at
      t.text :lock_reason
      t.text :unlock_reason

      # Audit
      t.integer :transactions_at_lock, default: 0  # Count at time of lock
      t.decimal :balance_at_lock, precision: 15, scale: 2  # Total balance at lock

      t.timestamps
    end

    add_index :gl_period_locks, [:corporate_company_id, :period_end], unique: true, name: "idx_period_locks_unique"
    add_index :gl_period_locks, [:corporate_company_id, :status], name: "idx_period_locks_status"

    # Add lock_date to company settings for quick lookup
    add_column :corporate_company_settings, :gl_lock_date, :date
  end
end
