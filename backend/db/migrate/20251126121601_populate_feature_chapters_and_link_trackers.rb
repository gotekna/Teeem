class PopulateFeatureChaptersAndLinkTrackers < ActiveRecord::Migration[8.0]
  def up
    # Extract unique chapters from existing feature_trackers
    chapters_data = execute(<<-SQL).to_a
      SELECT DISTINCT chapter FROM feature_trackers ORDER BY chapter
    SQL

    # Parse and create FeatureChapter records
    chapters_data.each_with_index do |row, index|
      chapter_string = row['chapter']
      # Parse "1. PRE-CONSTRUCTION & SALES" -> chapter_number: 1, name: "Pre-Construction & Sales"
      match = chapter_string.match(/^(\d+)\.\s*(.+)$/)

      if match
        chapter_number = match[1].to_i
        name = match[2].strip.titleize

        execute(<<-SQL)
          INSERT INTO feature_chapters (chapter_number, name, sort_order, created_at, updated_at)
          VALUES (#{chapter_number}, '#{name.gsub("'", "''")}', #{chapter_number}, NOW(), NOW())
        SQL
      end
    end

    # Now link each feature_tracker to its corresponding feature_chapter
    execute(<<-SQL)
      UPDATE feature_trackers ft
      SET feature_chapter_id = fc.id
      FROM feature_chapters fc
      WHERE CAST(SPLIT_PART(ft.chapter, '.', 1) AS INTEGER) = fc.chapter_number
    SQL

    # Verify all trackers are linked
    orphaned = execute("SELECT COUNT(*) FROM feature_trackers WHERE feature_chapter_id IS NULL").first['count'].to_i
    if orphaned > 0
      raise "Migration failed: #{orphaned} feature_trackers still have NULL feature_chapter_id"
    end

    # Now make the column NOT NULL
    change_column_null :feature_trackers, :feature_chapter_id, false
  end

  def down
    # Allow NULL again
    change_column_null :feature_trackers, :feature_chapter_id, true

    # Clear the chapter references
    execute("UPDATE feature_trackers SET feature_chapter_id = NULL")

    # Delete all feature chapters
    execute("DELETE FROM feature_chapters")
  end
end
