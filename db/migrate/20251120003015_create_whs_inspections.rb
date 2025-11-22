class CreateWHSInspections < ActiveRecord::Migration[8.0]
  def change
    create_table :whs_inspections do |t|
      # References
      t.references :construction, foreign_key: true, null: true
      t.bigint :whs_inspection_template_id, null: true # FK added later
      t.references :inspector_user, foreign_key: { to_table: :users }, null: true
      t.references :created_by, null: false, foreign_key: { to_table: :users }
      t.references :meeting, foreign_key: true, null: true # For toolbox talks

      # Core fields
      t.string :inspection_number, null: false
      t.string :inspection_type, null: false # daily, weekly, monthly, pre_start, equipment, toolbox_talk, ad_hoc
      t.string :status, null: false, default: 'scheduled' # scheduled, in_progress, completed, requires_action, cancelled
      t.string :title
      t.text :description

      # Scheduling
      t.date :scheduled_date
      t.datetime :started_at
      t.datetime :completed_at

      # Site conditions
      t.string :weather_conditions
      t.text :site_conditions

      # Results
      t.integer :total_items, default: 0
      t.integer :pass_count, default: 0
      t.integer :fail_count, default: 0
      t.integer :na_count, default: 0
      t.decimal :compliance_score, precision: 5, scale: 2 # Percentage
      t.boolean :overall_pass, default: false
      t.boolean :critical_issues_found, default: false

      # Sign-off
      t.text :inspector_signature
      t.text :overall_notes
      t.boolean :follow_up_required, default: false
      t.date :follow_up_date

      # Metadata
      t.jsonb :metadata, default: {}

      t.timestamps
    end

    add_index :whs_inspections, :inspection_number, unique: true
    add_index :whs_inspections, [:construction_id, :status]
    add_index :whs_inspections, :status
    add_index :whs_inspections, :inspection_type
    add_index :whs_inspections, :scheduled_date
    add_index :whs_inspections, :critical_issues_found
  end
end
