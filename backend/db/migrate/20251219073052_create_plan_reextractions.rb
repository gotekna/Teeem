class CreatePlanReextractions < ActiveRecord::Migration[8.0]
  def change
    create_table :plan_reextractions do |t|
      t.references :job, null: false, foreign_key: true
      t.string :status, default: "pending"
      t.string :current_step
      t.integer :total_plans
      t.integer :processed_plans
      t.string :current_plan_name
      t.jsonb :plans_updated, default: []
      t.jsonb :rename_errors, default: []
      t.text :error_message
      t.datetime :started_at
      t.datetime :completed_at

      t.timestamps
    end

    add_index :plan_reextractions, :status
  end
end
