# frozen_string_literal: true

class CreatePlanIdentificationRules < ActiveRecord::Migration[7.2]
  def change
    create_table :plan_identification_rules do |t|
      t.string :rule_type, null: false  # "keyword", "pattern", "exclusion"
      t.string :match_text, null: false  # The text to match
      t.references :plan_type, null: false, foreign_key: true
      t.integer :priority, default: 0  # Higher = checked first
      t.integer :success_count, default: 0  # How many times this rule succeeded
      t.integer :failure_count, default: 0  # How many times this rule was overridden
      t.boolean :is_active, default: true
      t.references :created_by, foreign_key: { to_table: :users }

      t.timestamps
    end

    add_index :plan_identification_rules, :rule_type
    add_index :plan_identification_rules, [:plan_type_id, :match_text], unique: true
    add_index :plan_identification_rules, [:is_active, :priority], order: { priority: :desc }
  end
end
