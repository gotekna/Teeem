class CreatePayNowWeeklyLimits < ActiveRecord::Migration[8.0]
  def change
    create_table :pay_now_weekly_limits do |t|
      # Financial limits - MUST use DECIMAL(15,2) per Trinity Rule 16.6
      t.decimal :total_limit, precision: 15, scale: 2, null: false, default: 0.0
      t.decimal :used_amount, precision: 15, scale: 2, null: false, default: 0.0
      t.decimal :remaining_amount, precision: 15, scale: 2, null: false, default: 0.0

      # Week tracking
      t.date :week_start_date, null: false
      t.date :week_end_date, null: false

      # Status tracking
      t.boolean :active, default: true, null: false

      # Audit fields
      t.references :set_by, foreign_key: { to_table: :users }, null: true
      t.decimal :previous_limit, precision: 15, scale: 2, null: true

      t.timestamps

      # Indexes for performance
      t.index :week_start_date
      t.index :active
      t.index [:active, :week_start_date], name: 'index_pay_now_weekly_limits_on_active_and_week'
    end
  end
end
