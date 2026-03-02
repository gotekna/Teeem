# frozen_string_literal: true

class AddMarkupCharges < ActiveRecord::Migration[7.1]
  def change
    # Job-level markup charges (one row per charge type per job)
    create_table :job_markup_charges do |t|
      t.bigint :job_id, null: false
      t.bigint :tenant_id
      t.string :charge_type, limit: 50, null: false
      # charge_type: qbcc_insurance, construction_insurance, qleave, overheads
      t.decimal :rate_percent, precision: 8, scale: 4
      t.decimal :override_amount, precision: 12, scale: 2
      t.decimal :calculated_amount, precision: 12, scale: 2, default: 0.0
      t.decimal :basis_value, precision: 12, scale: 2
      t.bigint :purchase_order_id
      t.timestamps

      t.index [:job_id, :charge_type], unique: true, name: "idx_job_markup_charges_job_type"
      t.index [:tenant_id]
      t.index [:purchase_order_id]
    end

    add_foreign_key :job_markup_charges, :jobs
    add_foreign_key :job_markup_charges, :tenants
    add_foreign_key :job_markup_charges, :purchase_orders

    # QBCC premium lookup brackets
    create_table :qbcc_premium_brackets do |t|
      t.string :category, limit: 50, null: false, default: "new_home"
      t.decimal :min_value, precision: 12, scale: 2, null: false
      t.decimal :max_value, precision: 12, scale: 2
      t.decimal :premium, precision: 10, scale: 2, null: false
      t.decimal :rate_per_thousand, precision: 8, scale: 4
      t.integer :sort_order, default: 0
      t.timestamps

      t.index [:category, :min_value], name: "idx_qbcc_brackets_cat_min"
    end

    # Default rates on SmSetting
    add_column :sm_settings, :default_construction_insurance_percent, :decimal, precision: 5, scale: 2, default: 0.0
    add_column :sm_settings, :default_overheads_percent, :decimal, precision: 5, scale: 2, default: 0.0
    add_column :sm_settings, :default_qleave_rate_percent, :decimal, precision: 6, scale: 4, default: 0.575
    add_column :sm_settings, :qleave_threshold, :decimal, precision: 12, scale: 2, default: 150_000.0
    add_column :sm_settings, :qbcc_minimum_threshold, :decimal, precision: 12, scale: 2, default: 3_300.0
  end
end
