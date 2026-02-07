# frozen_string_literal: true

# Clean double slashes in folder_path_template and related columns.
# Adjacent tokens like }}{{ are intentional (e.g., {{JobCode}}{{JobName}} = one folder segment).
#
class FixFolderPathTemplateSeparators < ActiveRecord::Migration[8.0]
  def up
    # Clean any double slashes in warehouse_types
    execute(<<~SQL)
      UPDATE warehouse_types
      SET folder_path_template = regexp_replace(folder_path_template, '//', '/', 'g')
      WHERE folder_path_template LIKE '%//%'
    SQL

    # Clean any double slashes in warehouse_folders
    execute(<<~SQL)
      UPDATE warehouse_folders
      SET folder_path_suffix = regexp_replace(folder_path_suffix, '//', '/', 'g')
      WHERE folder_path_suffix LIKE '%//%'
    SQL

    execute(<<~SQL)
      UPDATE warehouse_folders
      SET folder_segment = regexp_replace(folder_segment, '//', '/', 'g')
      WHERE folder_segment IS NOT NULL
        AND folder_segment LIKE '%//%'
    SQL
  end

  def down
    # Idempotent - no rollback needed
  end
end
