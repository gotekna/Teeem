# frozen_string_literal: true

class CreateSmScheduleMasterRelatedPos < ActiveRecord::Migration[8.0]
  def change
    create_table :sm_schedule_master_related_pos do |t|
      # The task that will see related PO info in its PO description
      t.references :sm_schedule_master, null: false, foreign_key: true

      # The related PO task whose supplier info will be included
      t.references :related_sm_schedule_master, null: false, foreign_key: { to_table: :sm_schedule_masters }

      # For ordering multiple related tasks
      t.integer :position, default: 0

      t.timestamps
    end

    # Ensure no duplicate relationships
    add_index :sm_schedule_master_related_pos,
              [:sm_schedule_master_id, :related_sm_schedule_master_id],
              unique: true,
              name: 'idx_sm_related_pos_unique'
  end
end
