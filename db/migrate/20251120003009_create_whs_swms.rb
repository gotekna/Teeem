class CreateWHSSwms < ActiveRecord::Migration[8.0]
  def change
    create_table :whs_swms do |t|
      # References
      t.references :construction, foreign_key: true, null: true # Nullable for company-wide SWMS
      t.references :created_by, null: false, foreign_key: { to_table: :users }
      t.references :approved_by, foreign_key: { to_table: :users }, null: true
      t.references :superseded_by, foreign_key: { to_table: :whs_swms }, null: true

      # Core fields
      t.string :swms_number, null: false
      t.string :title, null: false
      t.decimal :version, precision: 3, scale: 1, default: 1.0, null: false
      t.string :status, null: false, default: 'draft' # draft, pending_approval, approved, rejected, superseded
      t.boolean :company_wide, default: false, null: false

      # Activity details
      t.text :activity_description
      t.string :location_area
      t.string :high_risk_type # excavation, confined_spaces, work_at_heights, etc.
      t.date :start_date
      t.integer :expected_duration_days
      t.integer :workers_involved
      t.string :supervisor_responsible

      # Emergency & compliance
      t.text :emergency_procedures
      t.text :emergency_contact_numbers
      t.string :first_aid_location
      t.string :fire_extinguisher_location
      t.string :emergency_assembly_point
      t.text :evacuation_procedures
      t.text :legislative_references

      # PPE requirements (JSONB for flexibility)
      t.jsonb :ppe_requirements, default: {}

      # Required licenses/qualifications (JSONB array)
      t.jsonb :required_qualifications, default: []

      # Timestamps
      t.datetime :approved_at
      t.datetime :superseded_at
      t.string :rejection_reason

      # Metadata
      t.jsonb :metadata, default: {}

      t.timestamps
    end

    add_index :whs_swms, :swms_number, unique: true
    add_index :whs_swms, [:construction_id, :status]
    add_index :whs_swms, :status
    add_index :whs_swms, :company_wide
    add_index :whs_swms, :high_risk_type
  end
end
