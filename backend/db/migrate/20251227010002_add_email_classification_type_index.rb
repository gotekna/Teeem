# frozen_string_literal: true

class AddEmailClassificationTypeIndex < ActiveRecord::Migration[7.1]
  def change
    add_index :email_warehouse,
              "(email_classification->>'email_type')",
              name: "idx_email_warehouse_classification_type",
              where: "email_classification IS NOT NULL",
              using: :btree
  end
end
