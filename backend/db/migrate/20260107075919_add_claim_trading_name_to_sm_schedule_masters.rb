class AddClaimTradingNameToSmScheduleMasters < ActiveRecord::Migration[8.0]
  def change
    add_column :sm_schedule_masters, :claim_trading_name_id, :bigint
  end
end
