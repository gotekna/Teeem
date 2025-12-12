class AddUniqueIndexToDocumentExternalId < ActiveRecord::Migration[8.0]
  def up
    # Step 1: Find and remove ALL duplicate documents from Xero (keeping the oldest one)
    # This query finds all external_ids that have duplicates (PDFs and attachments)
    duplicates = execute(<<-SQL).to_a
      SELECT external_id
      FROM corporate_company_documents
      WHERE source = 'xero'
        AND external_id IS NOT NULL
      GROUP BY external_id
      HAVING COUNT(*) > 1
    SQL

    duplicates.each do |row|
      external_id = row['external_id']

      # Find all documents with this external_id, ordered by created_at (keep oldest)
      docs = execute(<<-SQL).to_a
        SELECT id, created_at
        FROM corporate_company_documents
        WHERE source = 'xero' AND external_id = '#{external_id}'
        ORDER BY created_at ASC
      SQL

      # Keep the first (oldest) one, delete the rest
      docs_to_delete = docs[1..-1] || []
      docs_to_delete.each do |doc|
        execute("DELETE FROM corporate_company_documents WHERE id = #{doc['id']}")
      end

      if docs_to_delete.any?
        puts "  Removed #{docs_to_delete.count} duplicate(s) for #{external_id} (kept ID: #{docs.first['id']})"
      end
    end

    # Step 2: Remove the old non-unique index
    remove_index :corporate_company_documents, :external_id, if_exists: true

    # Step 3: Add unique constraint on [source, external_id] to prevent future duplicates
    # Only applies when external_id is NOT NULL (partial unique index)
    add_index :corporate_company_documents,
              [:source, :external_id],
              unique: true,
              where: "external_id IS NOT NULL",
              name: 'index_corporate_company_documents_on_source_and_external_id'
  end

  def down
    # Remove the unique index
    remove_index :corporate_company_documents,
                 name: 'index_corporate_company_documents_on_source_and_external_id',
                 if_exists: true

    # Restore the old non-unique index
    add_index :corporate_company_documents, :external_id, if_exists: true
  end
end
