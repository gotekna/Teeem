class AddDependencyBrokenMetadataToSmScheduleMasters < ActiveRecord::Migration[8.0]
  def change
    add_column :sm_schedule_masters, :dependency_broken_at, :datetime
    add_column :sm_schedule_masters, :dependency_broken_by_id, :bigint
  end
end
