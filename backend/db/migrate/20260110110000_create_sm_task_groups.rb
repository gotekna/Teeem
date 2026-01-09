# frozen_string_literal: true

class CreateSmTaskGroups < ActiveRecord::Migration[7.1]
  def change
    # Create task groups table
    create_table :sm_task_groups do |t|
      t.string :name, null: false
      t.text :description
      t.boolean :is_active, default: true, null: false
      t.timestamps
    end

    # Add foreign key to sm_schedule_masters
    add_reference :sm_schedule_masters, :sm_task_group, foreign_key: true

    # Add index for active groups lookup
    add_index :sm_task_groups, :is_active
  end
end
