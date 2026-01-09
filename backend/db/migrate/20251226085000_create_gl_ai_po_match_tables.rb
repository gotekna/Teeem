# frozen_string_literal: true

class CreateGlAiPoMatchTables < ActiveRecord::Migration[7.1]
  def change
    # Track AI matching attempts for rate limiting
    create_table :gl_ai_po_match_attempts do |t|
      t.references :corporate_company, null: false, foreign_key: true, index: true
      t.references :bill_inbox, foreign_key: true, index: true
      t.references :matched_po, foreign_key: { to_table: :purchase_orders }
      t.boolean :successful, default: false
      t.integer :suggestions_count, default: 0
      t.integer :best_confidence

      t.timestamps
    end

    # Index for rate limiting queries
    add_index :gl_ai_po_match_attempts, [:corporate_company_id, :created_at],
              name: "idx_ai_po_attempts_rate_limit"

    # Store user feedback on AI matches for learning
    create_table :gl_ai_po_match_learnings do |t|
      t.references :corporate_company, null: false, foreign_key: true, index: true
      t.references :bill_inbox, null: false, foreign_key: true, index: true
      t.references :purchase_order, null: false, foreign_key: true, index: true
      t.references :user, foreign_key: true

      # What was matched
      t.boolean :was_accepted, null: false

      # Context for learning
      t.string :bill_supplier_name, limit: 255
      t.decimal :bill_amount, precision: 15, scale: 2
      t.string :po_supplier_name, limit: 255
      t.decimal :po_amount, precision: 15, scale: 2

      # Detailed match data for pattern analysis
      t.jsonb :match_data, default: {}

      t.timestamps
    end

    # Index for finding similar past matches
    add_index :gl_ai_po_match_learnings, [:corporate_company_id, :was_accepted],
              name: "idx_ai_po_learnings_acceptance"

    # Index for supplier name lookups
    add_index :gl_ai_po_match_learnings, :bill_supplier_name,
              using: :gin,
              opclass: :gin_trgm_ops,
              name: "idx_ai_po_learnings_supplier_trgm"
  end
end
