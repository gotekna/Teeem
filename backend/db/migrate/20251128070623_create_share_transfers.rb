class CreateShareTransfers < ActiveRecord::Migration[8.0]
  def change
    create_table :share_transfers do |t|
      t.references :company, null: false, foreign_key: true
      t.references :from_shareholder, foreign_key: { to_table: :contacts }
      t.references :to_shareholder, null: false, foreign_key: { to_table: :contacts }
      t.string :share_class, default: 'ordinary'
      t.integer :number_of_shares, null: false
      t.decimal :consideration, precision: 12, scale: 2  # Amount paid
      t.date :transfer_date, null: false
      t.string :document_reference
      t.text :notes

      t.timestamps
    end
    add_index :share_transfers, :transfer_date
    add_index :share_transfers, :share_class
  end
end
