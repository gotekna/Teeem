class AddCategoryToDocumentationEntries < ActiveRecord::Migration[8.0]
  def up
    # Add category column
    add_column :documentation_entries, :category, :string

    # Set category for existing entries based on entry_type
    execute <<-SQL
      UPDATE documentation_entries
      SET category = CASE
        WHEN entry_type IN ('component', 'feature', 'util', 'hook', 'integration', 'optimization') THEN 'teacher'
        WHEN entry_type IN ('bug', 'architecture', 'test', 'performance', 'dev_note', 'common_issue') THEN 'lexicon'
        ELSE 'other'
      END
    SQL

    # Add not null constraint after setting values
    change_column_null :documentation_entries, :category, false

    # Add index for performance
    add_index :documentation_entries, :category
    add_index :documentation_entries, [ :category, :chapter_number ]

    # Migrate Bible rules to documentation_entries
    execute <<-SQL
      INSERT INTO documentation_entries (
        category,
        chapter_number,
        chapter_name,
        section_number,
        title,
        entry_type,
        description,
        code_example,
        created_at,
        updated_at
      )
      SELECT
        'bible' as category,
        chapter_number,
        chapter_name,
        rule_number as section_number,
        title,
        COALESCE(rule_type, 'rule') as entry_type,
        description,
        code_example,
        created_at,
        updated_at
      FROM bible_rules
    SQL
  end

  def down
    # Remove migrated Bible entries
    execute "DELETE FROM documentation_entries WHERE category = 'bible'"

    # Remove indexes
    remove_index :documentation_entries, :category
    remove_index :documentation_entries, [ :category, :chapter_number ]

    # Remove column
    remove_column :documentation_entries, :category
  end
end
