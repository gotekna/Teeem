class AddCallTimeDaysToPricebook < ActiveRecord::Migration[8.0]
  def change
    add_column :pricebook, :call_time_days, :integer
  end
end
