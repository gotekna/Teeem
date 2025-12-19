# frozen_string_literal: true

class CreateAiProcessingLogs < ActiveRecord::Migration[8.0]
  def change
    create_table :ai_processing_logs do |t|
      t.string :service_type, null: false
      t.references :processable, polymorphic: true
      t.string :input_identifier

      # Layer results
      t.jsonb :ocr_result
      t.jsonb :pattern_result
      t.jsonb :ai_result

      # Final decision
      t.string :final_type
      t.integer :final_confidence
      t.string :decision_method

      # Correction tracking
      t.boolean :user_corrected, default: false
      t.string :corrected_to
      t.references :corrected_by, foreign_key: { to_table: :users }
      t.datetime :corrected_at

      # Performance
      t.integer :ocr_duration_ms
      t.integer :ai_duration_ms
      t.integer :total_duration_ms

      t.timestamps

      t.index :service_type
      t.index :created_at
      t.index [:service_type, :user_corrected]
    end
  end
end
