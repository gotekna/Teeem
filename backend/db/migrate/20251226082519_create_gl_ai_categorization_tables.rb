# frozen_string_literal: true

class CreateGlAiCategorizationTables < ActiveRecord::Migration[7.1]
  def change
    # Table to store AI categorization attempts (for rate limiting and analytics)
    create_table :gl_ai_categorization_attempts do |t|
      t.references :corporate, null: false, foreign_key: true, index: true
      t.string :transaction_description, limit: 500, null: false
      t.decimal :transaction_amount, precision: 15, scale: 2
      t.references :suggested_account, foreign_key: { to_table: :gl_accounts }, index: true
      t.decimal :confidence, precision: 4, scale: 3
      t.boolean :was_successful, default: false, null: false

      t.timestamps
    end

    # Index for rate limiting queries
    add_index :gl_ai_categorization_attempts, [:corporate_id, :created_at],
              name: "idx_ai_attempts_rate_limit"

    # Table to store user feedback on AI suggestions (for learning)
    create_table :gl_ai_categorization_learnings do |t|
      t.references :corporate, null: false, foreign_key: true, index: true
      t.string :transaction_description, limit: 500, null: false
      t.string :transaction_amount_type, limit: 10, null: false # "credit" or "debit"
      t.string :transaction_reference, limit: 255
      t.references :ai_suggested_account, foreign_key: { to_table: :gl_accounts }, index: true
      t.decimal :ai_confidence, precision: 4, scale: 3
      t.references :user_chosen_account, null: false, foreign_key: { to_table: :gl_accounts }, index: true
      t.boolean :was_accepted, default: false, null: false
      t.datetime :feedback_date, null: false

      t.timestamps
    end

    # Index for finding similar transactions
    add_index :gl_ai_categorization_learnings,
              [:corporate_id, :transaction_amount_type, :was_accepted],
              name: "idx_ai_learning_similar"

    # GIN index for description text search (PostgreSQL)
    add_index :gl_ai_categorization_learnings,
              :transaction_description,
              using: :gin,
              opclass: :gin_trgm_ops,
              name: "idx_ai_learning_description_trgm"
  end
end
