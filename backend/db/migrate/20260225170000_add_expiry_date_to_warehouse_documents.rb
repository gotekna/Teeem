# frozen_string_literal: true

class AddExpiryDateToWarehouseDocuments < ActiveRecord::Migration[7.1]
  def change
    add_column :warehouse_documents, :expiry_date, :date

    # Partial index: only index rows that have an expiry date set
    # Enables efficient queries for expired/expiring-soon documents
    add_index :warehouse_documents, [:tenant_id, :expiry_date],
              where: "expiry_date IS NOT NULL",
              name: "idx_warehouse_docs_tenant_expiry"
  end
end
