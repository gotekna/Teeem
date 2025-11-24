class CreateWHSActionItems < ActiveRecord::Migration[8.0]
  def change
    create_table :whs_action_items do |t|
      # Polymorphic association - can belong to inspection, incident, or hazard
      t.references :actionable, polymorphic: true, null: false

      # References
      t.references :assigned_to_user, foreign_key: { to_table: :users }, null: true
      t.references :created_by, null: false, foreign_key: { to_table: :users }
      t.references :project_task, foreign_key: true, null: true # Link to main task system

      # Action details
      t.string :title, null: false
      t.text :description
      t.string :action_type, null: false # immediate, short_term, long_term, preventative
      t.string :priority, null: false, default: 'medium' # low, medium, high, critical
      t.string :status, null: false, default: 'open' # open, in_progress, completed, cancelled

      # Scheduling
      t.date :due_date
      t.datetime :completed_at
      t.text :completion_notes

      # Metadata
      t.jsonb :metadata, default: {}

      t.timestamps
    end

    # Note: polymorphic reference already creates index on [:actionable_type, :actionable_id]
    add_index :whs_action_items, :status
    add_index :whs_action_items, :priority
    add_index :whs_action_items, :due_date
  end
end
