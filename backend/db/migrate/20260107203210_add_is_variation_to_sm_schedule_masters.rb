class AddIsVariationToSmScheduleMasters < ActiveRecord::Migration[8.0]
  def change
    add_column :sm_schedule_masters, :is_variation, :boolean, default: false
  end
end
