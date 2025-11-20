class CreateWhsIncidents < ActiveRecord::Migration[8.0]
  def change
    create_table :whs_incidents do |t|
      # References
      t.references :construction, foreign_key: true, null: true
      t.references :reported_by_user, null: false, foreign_key: { to_table: :users }
      t.references :investigated_by_user, foreign_key: { to_table: :users }, null: true

      # Incident details
      t.string :incident_number, null: false
      t.datetime :incident_date, null: false
      t.datetime :report_date, null: false
      t.string :location_description
      t.string :status, null: false, default: 'reported' # reported, under_investigation, actions_required, closed

      # Classification
      t.string :incident_category, null: false # near_miss, first_aid, medical_treatment, lti, property_damage, environmental, security, dangerous_occurrence
      t.string :incident_type # slip_trip_fall, manual_handling, hit_by_object, etc.
      t.string :severity_level, null: false # low, medium, high, critical

      # What happened
      t.text :what_happened, null: false
      t.string :activity_being_performed
      t.string :equipment_involved
      t.string :weather_conditions
      t.string :time_of_day
      t.string :lighting_conditions
      t.jsonb :contributing_factors, default: [] # Array of factors

      # Injured/affected person
      t.string :injured_person_name
      t.string :injured_person_company
      t.string :injured_person_role
      t.string :injury_type
      t.string :body_part_affected
      t.boolean :first_aid_given, default: false
      t.boolean :medical_treatment_required, default: false
      t.string :hospital_attended
      t.integer :time_lost_hours
      t.date :likely_return_date

      # Witnesses (JSONB array)
      t.jsonb :witnesses, default: []
      # Each: { name, contact, statement }

      # Immediate actions
      t.text :immediate_actions_taken

      # Investigation
      t.date :investigation_date
      t.text :immediate_cause
      t.text :underlying_causes
      t.text :recommendations

      # Photos/evidence
      t.jsonb :photo_urls, default: []
      t.jsonb :evidence_urls, default: []

      # WorkCover notification
      t.boolean :workcov_notification_required, default: false
      t.boolean :notifiable_incident, default: false
      t.date :workcov_notification_date
      t.string :workcov_reference_number

      # Closure
      t.datetime :closed_at
      t.text :closure_notes

      # Metadata
      t.jsonb :metadata, default: {}

      t.timestamps
    end

    add_index :whs_incidents, :incident_number, unique: true
    add_index :whs_incidents, [:construction_id, :status]
    add_index :whs_incidents, :status
    add_index :whs_incidents, :incident_category
    add_index :whs_incidents, :severity_level
    add_index :whs_incidents, :incident_date
    add_index :whs_incidents, :workcov_notification_required
  end
end
