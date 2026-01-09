class RenameDocumentedBugsToDocumentationEntries < ActiveRecord::Migration[8.0]
  def change
    # Rename the table
    rename_table :documented_bugs, :documentation_entries

    # Rename bug-specific columns to be more generic or entry-specific
    rename_column :documentation_entries, :bug_title, :title

    # Add teaching pattern specific fields
    add_column :documentation_entries, :section_number, :string
    add_column :documentation_entries, :difficulty, :string
    add_column :documentation_entries, :summary, :text
    add_column :documentation_entries, :code_example, :text
    add_column :documentation_entries, :common_mistakes, :text
    add_column :documentation_entries, :testing_strategy, :text
    add_column :documentation_entries, :related_rules, :text

    # Update the knowledge_type to entry_type for clarity
    rename_column :documentation_entries, :knowledge_type, :entry_type

    # Add new index for section_number
    add_index :documentation_entries, :section_number
    add_index :documentation_entries, [ :chapter_number, :section_number ]

    # Note: entry_type values will now include:
    # Lexicon types: 'bug', 'architecture', 'test', 'performance', 'dev_note', 'common_issue'
    # Teacher types: 'component', 'feature', 'util', 'hook', 'integration', 'optimization'
  end
end
