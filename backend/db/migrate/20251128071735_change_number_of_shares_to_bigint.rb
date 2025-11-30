class ChangeNumberOfSharesToBigint < ActiveRecord::Migration[8.0]
  def up
    change_column :company_shareholdings, :number_of_shares, :bigint, null: false
  end

  def down
    change_column :company_shareholdings, :number_of_shares, :integer, null: false
  end
end
