class RemoveUnusedColumnsFromSmScheduleMasters < ActiveRecord::Migration[8.0]
  def change
    # Remove unused backup/text columns from sm_schedule_masters
    # These columns have no code references and are just taking up space
    remove_column :sm_schedule_masters, :header_backup, :string
    remove_column :sm_schedule_masters, :trade_text, :string
    remove_column :sm_schedule_masters, :stage_text, :string
  end
end
