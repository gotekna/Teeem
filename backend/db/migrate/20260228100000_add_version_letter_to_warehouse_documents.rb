# frozen_string_literal: true

class AddVersionLetterToWarehouseDocuments < ActiveRecord::Migration[7.1]
  def up
    add_column :warehouse_documents, :version_letter, :string, limit: 5

    add_index :warehouse_documents, [:version_group_id, :version_letter],
              name: "idx_warehouse_docs_version_letter"

    # Backfill: Documents with version_number get computed letter (1=A, 2=B, etc.)
    # Documents without a version group get "A"
    execute <<~SQL
      UPDATE warehouse_documents
      SET version_letter = CASE
        WHEN version_number IS NOT NULL AND version_number > 0 AND version_number <= 26
          THEN CHR(64 + version_number)
        WHEN version_number IS NOT NULL AND version_number > 26
          THEN CHR(64 + ((version_number - 1) / 26)) || CHR(65 + ((version_number - 1) % 26))
        ELSE 'A'
      END
    SQL
  end

  def down
    remove_index :warehouse_documents, name: "idx_warehouse_docs_version_letter"
    remove_column :warehouse_documents, :version_letter
  end
end
