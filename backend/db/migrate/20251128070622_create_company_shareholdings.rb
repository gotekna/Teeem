class CreateCompanyShareholdings < ActiveRecord::Migration[8.0]
  def change
    create_table :company_shareholdings do |t|
      t.references :company, null: false, foreign_key: true
      t.references :shareholder, null: false, foreign_key: { to_table: :contacts }
      t.string :share_class, default: 'ordinary'
      t.integer :number_of_shares, null: false
      t.boolean :beneficially_held, default: false
      t.string :beneficial_owner  # Trust name if beneficially held
      t.date :acquired_date
      t.text :notes

      t.timestamps
    end
    add_index :company_shareholdings, [ :company_id, :shareholder_id, :share_class ],
              unique: true, name: 'idx_shareholdings_unique'
    add_index :company_shareholdings, :share_class
    add_index :company_shareholdings, :beneficially_held
  end
end
