class CreateMeetings < ActiveRecord::Migration[8.0]
  def change
    create_table :meetings do |t|
      t.string :title, null: false
      t.text :description
      t.datetime :start_time, null: false
      t.datetime :end_time, null: false
      t.string :location
      t.string :meeting_type, null: false  # site_visit, client_meeting, team_meeting, etc.
      t.string :status, null: false, default: 'scheduled'  # scheduled, in_progress, completed, cancelled
      t.references :construction, null: false, foreign_key: true
      t.references :created_by, null: false, foreign_key: { to_table: :users }
      t.text :notes
      t.string :video_url  # For Jitsi or other video meeting links
      t.jsonb :metadata, default: {}

      t.timestamps
    end

    add_index :meetings, :start_time
    add_index :meetings, :status
    add_index :meetings, :meeting_type
    add_index :meetings, [ :construction_id, :start_time ]
  end
end
