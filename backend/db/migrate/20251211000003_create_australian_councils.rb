class CreateAustralianCouncils < ActiveRecord::Migration[8.0]
  def change
    create_table :australian_councils do |t|
      t.string :postcode, limit: 4, null: false
      t.string :suburb, null: false
      t.string :state, limit: 3, null: false
      t.string :council_name, null: false
      t.string :council_type
      t.decimal :latitude, precision: 10, scale: 6
      t.decimal :longitude, precision: 10, scale: 6

      t.timestamps

      t.index [ :postcode, :suburb ], name: 'idx_councils_postcode_suburb'
      t.index :council_name
    end
  end
end
