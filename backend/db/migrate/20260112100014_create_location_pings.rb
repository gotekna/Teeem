# frozen_string_literal: true

class CreateLocationPings < ActiveRecord::Migration[8.0]
  def change
    create_table :location_pings do |t|
      t.references :site_presence_session, null: false, foreign_key: true
      t.references :worker_profile, null: false, foreign_key: true
      t.references :job, null: false, foreign_key: true

      # GPS coordinates
      t.decimal :latitude, precision: 10, scale: 7, null: false
      t.decimal :longitude, precision: 10, scale: 7, null: false
      t.decimal :accuracy, precision: 8, scale: 2  # horizontal accuracy in meters
      t.decimal :altitude, precision: 10, scale: 2  # meters above sea level
      t.decimal :speed, precision: 6, scale: 2  # meters per second
      t.decimal :heading, precision: 5, scale: 2  # degrees from north

      # Geofence status
      t.integer :distance_from_site  # meters from job site center
      t.boolean :within_geofence, default: true

      # Metadata
      t.string :source, limit: 20  # 'foreground', 'background', 'significant_change'
      t.integer :battery_level  # 0-100 percent
      t.string :battery_state, limit: 20  # 'charging', 'unplugged', 'full', 'unknown'

      # Timestamps
      t.datetime :recorded_at, null: false  # when device captured location
      t.timestamps
    end

    # Composite indexes for efficient queries
    add_index :location_pings, [:site_presence_session_id, :recorded_at], name: 'idx_location_pings_session_time'
    add_index :location_pings, [:worker_profile_id, :recorded_at], name: 'idx_location_pings_worker_time'
    add_index :location_pings, :created_at, name: 'idx_location_pings_created'  # for cleanup job
  end
end
