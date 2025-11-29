class CreateAssetInsurances < ActiveRecord::Migration[8.0]
  def change
    create_table :asset_insurances do |t|
      t.references :asset, null: false, foreign_key: true, index: true
      t.string :policy_number
      t.string :insurer_name
      t.string :broker_name
      t.string :broker_contact_name
      t.string :broker_email
      t.string :broker_phone
      t.date :start_date
      t.date :renewal_date
      t.string :payment_frequency
      t.decimal :premium_amount, precision: 10, scale: 2
      t.decimal :coverage_amount, precision: 12, scale: 2
      t.decimal :excess_amount, precision: 10, scale: 2
      t.string :status

      t.timestamps
    end

    add_index :asset_insurances, :renewal_date
    add_index :asset_insurances, :status
  end
end
