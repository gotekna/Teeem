# frozen_string_literal: true

class CreateGlDuplicateBillReviews < ActiveRecord::Migration[7.1]
  def change
    create_table :gl_duplicate_bill_reviews do |t|
      # The two bills being compared (bill1_id < bill2_id always)
      t.references :bill1, null: false, foreign_key: { to_table: :external_invoices }, index: true
      t.references :bill2, null: false, foreign_key: { to_table: :external_invoices }, index: true

      # Review status
      t.string :status, limit: 30, null: false, default: "pending"
      t.string :action_taken, limit: 30  # void, delete, link, ignore

      # If confirmed duplicate, which bill was kept/voided
      t.references :kept_bill, foreign_key: { to_table: :external_invoices }
      t.references :voided_bill, foreign_key: { to_table: :external_invoices }

      # Review metadata
      t.references :reviewed_by, foreign_key: { to_table: :users }
      t.datetime :reviewed_at
      t.text :notes

      # Detection metadata (stored when duplicate was first detected)
      t.integer :detection_score
      t.string :match_type, limit: 50
      t.text :detection_reasoning

      t.timestamps
    end

    # Unique index to prevent duplicate review records
    add_index :gl_duplicate_bill_reviews,
              [:bill1_id, :bill2_id],
              unique: true,
              name: "idx_duplicate_bill_reviews_pair"

    # Index for finding pending reviews
    add_index :gl_duplicate_bill_reviews,
              :status,
              name: "idx_duplicate_bill_reviews_status"
  end
end
