# frozen_string_literal: true

class CreateGlConstructionFeatures < ActiveRecord::Migration[7.1]
  def change
    # ===== LIEN WAIVERS =====
    create_table :gl_lien_waivers do |t|
      t.references :corporate, null: false, foreign_key: true
      t.references :job, null: false, foreign_key: true
      t.references :contact, null: false, foreign_key: true  # Subcontractor
      t.references :progress_claim, foreign_key: { to_table: :gl_progress_claims }

      t.string :waiver_type, null: false, limit: 30
      # conditional_partial, conditional_final, unconditional_partial, unconditional_final

      t.date :waiver_date, null: false
      t.decimal :through_amount, precision: 15, scale: 2  # Amount covered by waiver
      t.date :through_date  # Work through date

      t.string :status, default: "requested", limit: 20
      # requested, received, approved, rejected

      # Document
      t.string :document_file_id
      t.datetime :received_at
      t.string :received_from
      t.text :notes

      t.timestamps
    end

    add_index :gl_lien_waivers, [:corporate_id, :job_id, :contact_id],
              name: "idx_lien_waivers_job_contact"
    add_index :gl_lien_waivers, [:status], name: "idx_lien_waivers_status"

    # ===== CHANGE ORDERS =====
    create_table :gl_change_orders do |t|
      t.references :corporate, null: false, foreign_key: true
      t.references :job, null: false, foreign_key: true
      t.references :contact, foreign_key: true  # Client
      t.references :requested_by, foreign_key: { to_table: :users }
      t.references :approved_by, foreign_key: { to_table: :users }

      t.string :change_order_number, null: false
      t.string :title, null: false
      t.text :description
      t.string :reason  # client_request, design_change, unforeseen_conditions, etc.

      t.string :status, default: "draft", limit: 20
      # draft, submitted, approved, rejected, void

      # Financial impact
      t.decimal :contract_amount_change, precision: 15, scale: 2, default: 0
      t.decimal :cost_change, precision: 15, scale: 2, default: 0
      t.integer :schedule_days_change, default: 0

      # Original contract values (for tracking)
      t.decimal :original_contract_value, precision: 15, scale: 2
      t.decimal :revised_contract_value, precision: 15, scale: 2

      # Approval
      t.datetime :submitted_at
      t.datetime :approved_at
      t.datetime :rejected_at
      t.text :rejection_reason
      t.string :client_signature
      t.datetime :client_signed_at

      t.timestamps
    end

    add_index :gl_change_orders, [:corporate_id, :job_id, :change_order_number],
              unique: true, name: "idx_change_orders_number"
    add_index :gl_change_orders, [:status], name: "idx_change_orders_status"

    # Change order line items
    create_table :gl_change_order_lines do |t|
      t.references :change_order, null: false, foreign_key: { to_table: :gl_change_orders }

      t.integer :sort_order, default: 0
      t.string :description, null: false
      t.decimal :quantity, precision: 15, scale: 4, default: 1
      t.string :unit_of_measure, limit: 20
      t.decimal :unit_price, precision: 15, scale: 4
      t.decimal :amount, precision: 15, scale: 2

      t.string :cost_code
      t.string :cost_type  # labor, material, equipment, subcontract, other

      t.timestamps
    end

    # ===== EQUIPMENT COSTING =====
    create_table :gl_equipment do |t|
      t.references :corporate, null: false, foreign_key: true

      t.string :equipment_number, null: false
      t.string :name, null: false
      t.text :description
      t.string :category  # heavy, light, vehicles, tools

      t.string :status, default: "active", limit: 20
      # active, maintenance, retired

      # Ownership
      t.string :ownership_type, default: "owned", limit: 20  # owned, leased, rented
      t.decimal :purchase_price, precision: 15, scale: 2
      t.date :purchase_date
      t.decimal :current_value, precision: 15, scale: 2
      t.string :vendor_name

      # Rates
      t.decimal :hourly_rate, precision: 10, scale: 2  # Internal charge rate
      t.decimal :daily_rate, precision: 10, scale: 2
      t.decimal :weekly_rate, precision: 10, scale: 2
      t.decimal :monthly_rate, precision: 10, scale: 2

      # Operating costs
      t.decimal :fuel_cost_per_hour, precision: 10, scale: 4
      t.decimal :maintenance_cost_per_hour, precision: 10, scale: 4

      # Usage tracking
      t.decimal :total_hours, precision: 15, scale: 2, default: 0
      t.datetime :last_used_at

      t.timestamps
    end

    add_index :gl_equipment, [:corporate_id, :equipment_number],
              unique: true, name: "idx_equipment_number"
    add_index :gl_equipment, [:status], name: "idx_equipment_status"

    # Equipment usage records (per job)
    create_table :gl_equipment_usages do |t|
      t.references :equipment, null: false, foreign_key: { to_table: :gl_equipment }
      t.references :job, null: false, foreign_key: true
      t.references :user, foreign_key: true  # Operator

      t.date :usage_date, null: false
      t.decimal :hours, precision: 8, scale: 2, null: false
      t.decimal :hourly_rate, precision: 10, scale: 2
      t.decimal :total_cost, precision: 15, scale: 2

      t.string :cost_code
      t.text :notes

      # Meter readings
      t.decimal :start_meter
      t.decimal :end_meter

      t.timestamps
    end

    add_index :gl_equipment_usages, [:equipment_id, :usage_date],
              name: "idx_equipment_usage_date"
    add_index :gl_equipment_usages, [:job_id, :usage_date],
              name: "idx_equipment_usage_job"
  end
end
