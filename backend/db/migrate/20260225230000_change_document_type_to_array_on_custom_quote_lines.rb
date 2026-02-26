class ChangeDocumentTypeToArrayOnCustomQuoteLines < ActiveRecord::Migration[8.0]
  def up
    add_column :custom_quote_lines, :document_type_ids, :integer, array: true, default: [], null: false

    # Migrate existing single document_type_id to array
    execute <<-SQL
      UPDATE custom_quote_lines
      SET document_type_ids = ARRAY[document_type_id]
      WHERE document_type_id IS NOT NULL
    SQL

    remove_reference :custom_quote_lines, :document_type
  end

  def down
    add_reference :custom_quote_lines, :document_type, null: true, foreign_key: true

    execute <<-SQL
      UPDATE custom_quote_lines
      SET document_type_id = document_type_ids[1]
      WHERE array_length(document_type_ids, 1) > 0
    SQL

    remove_column :custom_quote_lines, :document_type_ids
  end
end
