class CreateInsurancePolicies < ActiveRecord::Migration[8.0]
  def change
    create_table :insurance_policies do |t|
      t.references :company, null: false, foreign_key: true
      t.string :cover_type
      t.string :insured_party
      t.date :start_date
      t.date :renewal_date
      t.decimal :annual_premium
      t.decimal :monthly_premium
      t.string :broker
      t.text :notes

      t.timestamps
    end
  end
end
