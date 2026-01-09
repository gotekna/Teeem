# frozen_string_literal: true

class CreateGlPeriods < ActiveRecord::Migration[8.0]
  def change
    create_table :gl_periods do |t|
      t.references :corporate_company, null: false, foreign_key: true

      # External provider linking
      t.string :external_provider         # 'xero', 'quickbooks', 'myob', nil
      t.string :external_tenant_id        # Provider's org/company ID

      # Period Identity
      t.string :financial_year, null: false   # "FY2025" (July 2024 - June 2025)
      t.integer :period_number, null: false   # 1-12 (July=1, June=12 for AU)
      t.string :period_name                   # "July 2024", "August 2024"

      # Dates
      t.date :period_start, null: false
      t.date :period_end, null: false

      # Status
      t.string :status, default: 'open'       # open, closed, locked
      t.datetime :closed_at
      t.references :closed_by, foreign_key: { to_table: :users }

      t.timestamps
    end

    # Unique constraint: one period per FY per company per provider tenant
    add_index :gl_periods, [:corporate_company_id, :external_provider, :external_tenant_id, :financial_year, :period_number],
              unique: true, name: 'idx_gl_periods_unique'

    # Performance indexes
    add_index :gl_periods, :financial_year
    add_index :gl_periods, :status
    add_index :gl_periods, [:period_start, :period_end]
  end
end
