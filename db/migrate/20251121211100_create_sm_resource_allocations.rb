class CreateSmResourceAllocations < ActiveRecord::Migration[8.0]
  def change
    create_table :sm_resource_allocations do |t|
      # Foreign Keys
      t.references :task, null: false, foreign_key: { to_table: :sm_tasks, on_delete: :cascade }
      t.references :resource, null: false, foreign_key: { to_table: :sm_resources, on_delete: :cascade }

      # Allocation Details
      t.decimal :allocated_hours, precision: 10, scale: 2
      t.decimal :allocated_quantity, precision: 10, scale: 2
      t.date :allocation_date

      # Status
      t.string :status, limit: 20, default: 'planned' # planned, confirmed, in_progress, completed

      t.timestamps
    end

    # Indexes
    add_index :sm_resource_allocations, :status
    add_index :sm_resource_allocations, :allocation_date
    add_index :sm_resource_allocations, [:task_id, :resource_id, :allocation_date], unique: true, name: 'idx_sm_allocations_unique'
  end
end
