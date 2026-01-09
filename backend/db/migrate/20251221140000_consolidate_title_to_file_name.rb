# SSoT Refactor: file_name is THE filename field, title is deprecated
class ConsolidateTitleToFileName < ActiveRecord::Migration[8.0]
  def up
    # Step 1: Copy all title values to file_name where different
    execute <<-SQL
      UPDATE corporate_company_documents
      SET file_name = title
      WHERE title IS NOT NULL
        AND (file_name IS NULL OR file_name != title)
    SQL

    # Step 2: Ensure file_name has a value for all records
    # Copy from title if file_name is still null
    execute <<-SQL
      UPDATE corporate_company_documents
      SET file_name = COALESCE(file_name, title, 'Unknown')
      WHERE file_name IS NULL
    SQL
  end

  def down
    # No rollback needed - title column still exists
  end
end
