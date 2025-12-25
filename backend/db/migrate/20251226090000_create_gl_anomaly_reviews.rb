# frozen_string_literal: true

class CreateGlAnomalyReviews < ActiveRecord::Migration[7.1]
  def change
    create_table :gl_anomaly_reviews do |t|
      t.references :corporate_company, null: false, foreign_key: true, index: true
      t.string :transaction_type, null: false, limit: 50
      t.bigint :transaction_id, null: false
      t.string :status, null: false, limit: 30, default: "acknowledged"
      t.integer :anomaly_score
      t.text :notes

      t.references :reviewed_by, foreign_key: { to_table: :users }
      t.datetime :reviewed_at

      t.timestamps
    end

    # Unique index on transaction
    add_index :gl_anomaly_reviews,
              [:corporate_company_id, :transaction_type, :transaction_id],
              unique: true,
              name: "idx_anomaly_reviews_transaction"

    # Index for finding pending reviews
    add_index :gl_anomaly_reviews, :status
  end
end
