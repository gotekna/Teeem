# frozen_string_literal: true

class CreateGlScheduledReports < ActiveRecord::Migration[7.1]
  def change
    create_table :gl_scheduled_reports do |t|
      t.references :corporate_company, null: false, foreign_key: true
      t.references :created_by, foreign_key: { to_table: :users }

      t.string :name, null: false
      t.string :report_type, null: false, limit: 50
      t.string :frequency, null: false, limit: 20  # daily, weekly, monthly, quarterly
      t.string :format, null: false, default: "pdf", limit: 10  # pdf, csv, excel

      # Scheduling
      t.integer :day_of_week  # 0-6 for weekly (0=Sunday)
      t.integer :day_of_month  # 1-31 for monthly/quarterly
      t.time :send_at, default: "08:00:00"  # Time to send (Brisbane)

      # Delivery
      t.text :recipients  # JSON array of email addresses
      t.string :email_subject
      t.text :email_body

      # Report Parameters (stored as JSON)
      t.jsonb :parameters, default: {}

      # Status
      t.boolean :active, default: true
      t.datetime :last_sent_at
      t.datetime :next_send_at
      t.integer :send_count, default: 0
      t.text :last_error

      t.timestamps
    end

    add_index :gl_scheduled_reports, [:active, :next_send_at], name: "idx_scheduled_reports_due"
    add_index :gl_scheduled_reports, [:corporate_company_id, :report_type], name: "idx_scheduled_reports_type"
  end
end
