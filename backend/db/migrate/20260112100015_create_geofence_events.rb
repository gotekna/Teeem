# frozen_string_literal: true

class CreateGeofenceEvents < ActiveRecord::Migration[8.0]
  def change
    create_table :geofence_events do |t|
      t.references :site_presence_session, null: false, foreign_key: true
      t.references :worker_profile, null: false, foreign_key: true
      t.references :job, null: false, foreign_key: true

      # Event details
      t.string :event_type, limit: 20, null: false  # 'exit', 'enter', 'dwell_outside'
      t.decimal :latitude, precision: 10, scale: 7
      t.decimal :longitude, precision: 10, scale: 7
      t.integer :distance_from_site  # how far outside geofence (meters)

      # Timing
      t.datetime :detected_at, null: false
      t.datetime :resolved_at  # when worker re-entered or session ended
      t.integer :duration_seconds  # time spent outside geofence

      # Notification tracking
      t.boolean :notification_sent, default: false
      t.boolean :acknowledged, default: false
      t.references :acknowledged_by, foreign_key: { to_table: :users }
      t.datetime :acknowledged_at
      t.text :acknowledgment_notes

      t.timestamps
    end

    add_index :geofence_events, [:site_presence_session_id, :event_type], name: 'idx_geofence_events_session_type'
    add_index :geofence_events, [:worker_profile_id, :created_at], name: 'idx_geofence_events_worker_time'
    add_index :geofence_events, [:job_id, :detected_at], name: 'idx_geofence_events_job_time'
  end
end
