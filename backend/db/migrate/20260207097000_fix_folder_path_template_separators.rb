# frozen_string_literal: true

# Fix folder_path_templates with missing / between adjacent tokens
#
# Root cause: Admin UI allows free-text editing with no normalization.
# Adjacent }}{{ tokens need / separator, e.g.:
#   "Task/{{JobName}}{{TaskId}}{{TaskName}}" → "Task/{{JobName}}/{{TaskId}}/{{TaskName}}"
#
class FixFolderPathTemplateSeparators < ActiveRecord::Migration[8.0]
  def up
    # Fix warehouse_types.folder_path_template: insert / between adjacent }}{{
    execute(<<~SQL)
      UPDATE warehouse_types
      SET folder_path_template = regexp_replace(
        folder_path_template,
        '\\}\\}\\s*\\{\\{',
        '}}/{{',
        'g'
      )
      WHERE folder_path_template ~ '\\}\\}\\s*\\{\\{'
    SQL

    # Fix warehouse_folders.folder_path_suffix: same pattern
    execute(<<~SQL)
      UPDATE warehouse_folders
      SET folder_path_suffix = regexp_replace(
        folder_path_suffix,
        '\\}\\}\\s*\\{\\{',
        '}}/{{',
        'g'
      )
      WHERE folder_path_suffix IS NOT NULL
        AND folder_path_suffix ~ '\\}\\}\\s*\\{\\{'
    SQL

    # Fix warehouse_folders.folder_segment: same pattern
    execute(<<~SQL)
      UPDATE warehouse_folders
      SET folder_segment = regexp_replace(
        folder_segment,
        '\\}\\}\\s*\\{\\{',
        '}}/{{',
        'g'
      )
      WHERE folder_segment IS NOT NULL
        AND folder_segment ~ '\\}\\}\\s*\\{\\{'
    SQL

    # Clean any double slashes that resulted
    execute(<<~SQL)
      UPDATE warehouse_types
      SET folder_path_template = regexp_replace(folder_path_template, '//', '/', 'g')
      WHERE folder_path_template LIKE '%//%'
    SQL

    execute(<<~SQL)
      UPDATE warehouse_folders
      SET folder_path_suffix = regexp_replace(folder_path_suffix, '//', '/', 'g')
      WHERE folder_path_suffix LIKE '%//%'
    SQL
  end

  def down
    # Not reversible - we don't know which records had missing separators
    raise ActiveRecord::IrreversibleMigration
  end
end
