class CreateJobActivities < ActiveRecord::Migration[8.0]
  def change
    create_table :job_activities do |t|
      t.references :job, null: false, foreign_key: true
      t.references :user, foreign_key: true  # nullable for system actions
      t.string :activity_type, null: false
      t.text :description
      t.jsonb :metadata, default: {}
      t.string :related_type  # polymorphic reference (e.g., 'PurchaseOrder', 'Contact')
      t.bigint :related_id
      t.string :related_url   # URL to view the related item (e.g., PDF document link)
      t.datetime :occurred_at, null: false, default: -> { 'CURRENT_TIMESTAMP' }

      t.timestamps
    end

    add_index :job_activities, :activity_type
    add_index :job_activities, :occurred_at
    add_index :job_activities, [ :related_type, :related_id ]
  end
end
