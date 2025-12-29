# frozen_string_literal: true

class CreateSmVoiceNotes < ActiveRecord::Migration[7.1]
  def change
    create_table :sm_voice_notes do |t|
      t.references :sm_task, null: false, foreign_key: { to_table: :sm_tasks }
      t.references :recorded_by, foreign_key: { to_table: :users }
      t.references :resource, foreign_key: { to_table: :sm_resources }

      t.string :audio_url, null: false
      t.integer :duration_seconds
      t.datetime :recorded_at

      # Transcription fields
      t.text :transcription
      t.float :transcription_confidence
      t.datetime :transcribed_at
      t.text :transcription_error

      t.timestamps
    end

    add_index :sm_voice_notes, :recorded_at
  end
end
