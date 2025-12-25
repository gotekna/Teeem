# frozen_string_literal: true

class CreateGlBasLodgements < ActiveRecord::Migration[7.1]
  def change
    create_table :gl_bas_lodgements do |t|
      t.references :corporate_company, null: false, foreign_key: true, index: true

      # Period identification
      t.string :period_code, null: false, limit: 10   # Q1, Q2, Q3, Q4 or M01-M12
      t.integer :period_year, null: false              # Financial year start (2024 = FY2024-25)

      # Status
      t.string :status, null: false, limit: 20, default: "pending"
      t.boolean :is_amendment, default: false

      # ATO Response
      t.string :lodgement_reference, limit: 100       # ATO reference number
      t.datetime :lodged_at
      t.text :error_message
      t.jsonb :ato_response, default: {}

      # BAS Data (complete snapshot)
      t.jsonb :data, default: {}

      # Audit
      t.references :lodged_by, foreign_key: { to_table: :users }

      t.timestamps
    end

    # Unique index per period (allowing amendments)
    add_index :gl_bas_lodgements,
              [:corporate_company_id, :period_code, :period_year, :is_amendment, :created_at],
              name: "idx_bas_lodgements_period"

    # Index for finding lodged periods
    add_index :gl_bas_lodgements, :status

    # Index for ATO reference lookup
    add_index :gl_bas_lodgements, :lodgement_reference, unique: true,
              where: "lodgement_reference IS NOT NULL"
  end
end
