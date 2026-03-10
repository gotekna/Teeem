class AddPropertyValuationFields < ActiveRecord::Migration[7.1]
  def change
    change_table :properties do |t|
      # Purchase & Valuation
      t.decimal :purchase_price, precision: 12, scale: 2
      t.date :purchase_date
      t.decimal :current_valuation, precision: 12, scale: 2
      t.date :valuation_date

      # Land & Building (for Cost Approach)
      t.decimal :land_value, precision: 12, scale: 2
      t.decimal :building_replacement_cost, precision: 12, scale: 2
      t.string :construction_type # brick_veneer, timber_frame, concrete, steel_frame, double_brick

      # Annual Expenses (for Net Yield / Cap Rate)
      t.decimal :management_fee_pct, precision: 5, scale: 2, default: 0
      t.decimal :vacancy_rate_pct, precision: 5, scale: 2, default: 0
      t.decimal :annual_insurance, precision: 10, scale: 2, default: 0
      t.decimal :annual_council_rates, precision: 10, scale: 2, default: 0
      t.decimal :annual_water_rates, precision: 10, scale: 2, default: 0
      t.decimal :annual_body_corporate, precision: 10, scale: 2, default: 0
      t.decimal :annual_other_expenses, precision: 10, scale: 2, default: 0

      # CGT Cost Base
      t.decimal :cost_base_stamp_duty, precision: 10, scale: 2, default: 0
      t.decimal :cost_base_legal_fees, precision: 10, scale: 2, default: 0
      t.decimal :cost_base_other, precision: 10, scale: 2, default: 0
      t.decimal :capital_improvements_total, precision: 12, scale: 2, default: 0
    end
  end
end
