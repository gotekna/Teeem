class RemovePoPriceHistoryIdsFromSmTemplateRows < ActiveRecord::Migration[8.0]
  def change
    remove_column :sm_schedule_master, :po_price_history_ids, :integer, array: true, default: []
  end
end
