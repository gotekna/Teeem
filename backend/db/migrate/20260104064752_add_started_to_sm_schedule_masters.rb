class AddStartedToSmScheduleMasters < ActiveRecord::Migration[8.0]
  def change
    add_column :sm_schedule_masters, :started, :boolean, default: false
    add_index :sm_schedule_masters, :started, where: "(started = true)"
  end
end
