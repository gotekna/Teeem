# frozen_string_literal: true

class CreatePlanIdentifications < ActiveRecord::Migration[7.2]
  def change
    create_table :plan_identifications do |t|
      t.references :job_plan, null: false, foreign_key: true
      t.references :identified_plan_type, foreign_key: { to_table: :plan_types }
      t.references :identified_plan_category, foreign_key: { to_table: :plan_categories }

      # OCR Layer Results (Phase 2)
      t.text :ocr_raw_text
      t.jsonb :ocr_structured_fields, default: {}  # { sheet_number, sheet_name, date, revision }
      t.integer :ocr_confidence  # 0-100

      # Pattern Match Layer Results
      t.integer :pattern_match_plan_type_id
      t.integer :pattern_match_confidence  # 0-100
      t.string :pattern_match_reason  # "exact_match", "fuzzy_match", "keyword_match", "no_match"

      # AI Layer Results
      t.integer :ai_plan_type_id
      t.integer :ai_confidence  # 0-100
      t.text :ai_reasoning
      t.boolean :ai_invoked, default: false

      # Extracted Sheet Info
      t.string :sheet_number
      t.string :sheet_name
      t.string :sheet_date
      t.string :sheet_issue

      # Final Decision
      t.integer :final_confidence  # 0-100 weighted average
      t.string :decision_status  # "auto_assigned", "spot_check", "needs_review", "human_required"
      t.boolean :human_reviewed, default: false
      t.references :reviewed_by, foreign_key: { to_table: :users }
      t.datetime :reviewed_at

      # Human Override (for learning)
      t.integer :human_override_plan_type_id
      t.text :human_override_reason

      t.timestamps
    end

    add_index :plan_identifications, :decision_status
    add_index :plan_identifications, :human_reviewed
    add_index :plan_identifications, [:job_plan_id, :created_at], order: { created_at: :desc }
  end
end
