class AddDisplayCodeToEntityTabs < ActiveRecord::Migration[8.0]
  def up
    add_column :entity_tabs, :display_code, :string, limit: 3

    # Auto-populate display_code for existing tabs
    # Use first letters of words in display_name (max 3 chars)
    execute <<-SQL
      UPDATE entity_tabs
      SET display_code = UPPER(
        CASE
          WHEN display_name ~ '^[A-Za-z]+$' THEN LEFT(display_name, 3)
          ELSE (
            SELECT string_agg(LEFT(word, 1), '')
            FROM (
              SELECT unnest(regexp_split_to_array(display_name, '\s+')) AS word
              LIMIT 3
            ) words
          )
        END
      )
    SQL
  end

  def down
    remove_column :entity_tabs, :display_code
  end
end
