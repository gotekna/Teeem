class UpdateDocumentTypeFoldersToMatchTabs < ActiveRecord::Migration[8.0]
  def up
    # Update folder to match primary_tab for consistency
    execute <<-SQL
      UPDATE document_types
      SET folder = primary_tab
      WHERE primary_tab IS NOT NULL
    SQL
  end

  def down
    # No need to reverse - this is a data consistency update
  end
end
