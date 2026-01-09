class CreateSmRecurringTaskDefinitions < ActiveRecord::Migration[7.2]
  def change
    create_table :sm_recurring_task_definitions do |t|
      # Template info
      t.string :name, null: false
      t.text :description

      # Status
      t.boolean :is_active, default: true
      t.string :status, default: 'active' # active, paused, completed, cancelled

      # Schedule
      t.string :frequency, null: false # daily, weekly, fortnightly, monthly, quarterly, annually
      t.integer :frequency_interval, default: 1 # every N periods
      t.integer :day_of_month # for monthly (1-28, or -1 for last day)
      t.integer :day_of_week # for weekly (0=Sunday, 1=Monday, etc.)
      t.date :start_date, null: false
      t.date :end_date # null = no end date
      t.integer :occurrences_limit # null = unlimited, otherwise stop after N
      t.integer :occurrences_count, default: 0

      # Generation tracking
      t.integer :advance_days, default: 7 # Generate N days ahead
      t.date :last_generated_for_date
      t.date :next_generation_date

      # Assignment (mutually exclusive)
      t.string :assignment_type, default: 'user' # 'user' or 'role'
      t.references :assigned_user, foreign_key: { to_table: :users }, null: true
      t.string :assigned_role # admin, sales, site, supervisor, builder, estimator

      # Task defaults
      t.integer :default_duration_days, default: 1
      t.string :trade
      t.string :stage
      t.references :checklist, null: true # optional checklist template

      # Job (optional - for job-specific recurring tasks)
      t.references :job, foreign_key: true, null: true

      # Skip configuration (JSONB)
      # { skip_weekends: true, skip_holidays: true, skip_user_leave: true }
      t.jsonb :skip_config, default: {}

      # Notifications
      t.boolean :notify_on_create, default: true
      t.boolean :notify_on_due, default: false

      # Audit
      t.references :created_by, foreign_key: { to_table: :users }
      t.references :updated_by, foreign_key: { to_table: :users }

      t.timestamps
    end

    add_index :sm_recurring_task_definitions, :next_generation_date
    add_index :sm_recurring_task_definitions, [:is_active, :status]
    add_index :sm_recurring_task_definitions, :assigned_role
  end
end
