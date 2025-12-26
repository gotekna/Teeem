class RemoveParentRowIdFromSmScheduleMaster < ActiveRecord::Migration[8.0]
  def change
    remove_column :sm_schedule_master, :parent_row_id, :bigint
  end
end
