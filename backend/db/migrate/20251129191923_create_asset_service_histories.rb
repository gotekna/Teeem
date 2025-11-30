class CreateAssetServiceHistories < ActiveRecord::Migration[8.0]
  def change
    create_table :asset_service_histories do |t|
      t.references :asset, null: false, foreign_key: true, index: true
      t.references :user, null: true, foreign_key: true
      t.date :service_date, null: false
      t.string :service_type
      t.string :service_provider
      t.text :description
      t.decimal :cost, precision: 10, scale: 2
      t.integer :odometer_reading
      t.integer :hours_reading
      t.integer :next_service_km
      t.integer :next_service_hours
      t.date :next_service_date
      t.string :invoice_url
      t.string :document_url

      t.timestamps
    end

    add_index :asset_service_histories, :service_date
    add_index :asset_service_histories, :service_type
  end
end
