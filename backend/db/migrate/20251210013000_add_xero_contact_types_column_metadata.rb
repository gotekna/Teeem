class AddXeroContactTypesColumnMetadata < ActiveRecord::Migration[8.0]
  def up
    # Find the Contact foundation
    foundation = execute("SELECT id FROM foundations WHERE name = 'Contact'").first
    return unless foundation

    foundation_id = foundation['id']

    # Check if column already exists in metadata
    existing = execute("SELECT id FROM columns WHERE foundation_id = #{foundation_id} AND column_name = 'xero_contact_types'").first
    return if existing

    # Get the max position for Contact foundation columns
    max_position = execute("SELECT COALESCE(MAX(position), 0) as max_pos FROM columns WHERE foundation_id = #{foundation_id}").first['max_pos']
    next_position = max_position.to_i + 1

    # Insert the column metadata
    execute <<-SQL
      INSERT INTO columns (
        foundation_id,
        name,
        column_name,
        column_type,
        description,
        searchable,
        is_title,
        is_unique,
        required,
        position,
        column_group,
        created_at,
        updated_at
      ) VALUES (
        #{foundation_id},
        'Xero Contact Types',
        'xero_contact_types',
        'array_text',
        'Customer and/or Supplier status from Xero (can be both)',
        true,
        false,
        false,
        false,
        #{next_position},
        'Xero Integration',
        NOW(),
        NOW()
      )
    SQL

    puts "✅ Added xero_contact_types column metadata to Contact foundation"
  end

  def down
    foundation = execute("SELECT id FROM foundations WHERE name = 'Contact'").first
    return unless foundation

    foundation_id = foundation['id']

    execute("DELETE FROM columns WHERE foundation_id = #{foundation_id} AND column_name = 'xero_contact_types'")

    puts "Removed xero_contact_types column metadata"
  end
end
