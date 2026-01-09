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

    # Create Foundation record for sm_task_groups
    reversible do |dir|
      dir.up do
        Foundation.create!(
          name: "SM Task Groups",
          singular_name: "Task Group",
          plural_name: "Task Groups",
          database_table_name: "sm_task_groups",
          slug: "sm_task_groups",
          table_type: "lookup",
          feature: "schedule_master",
          searchable: true,
          is_live: true,
          has_ui: true,
          has_saved_views: true
        )
      end

      dir.down do
        Foundation.find_by(slug: "sm_task_groups")&.destroy
      end
    end
  end
end
