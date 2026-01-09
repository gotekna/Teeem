class AddMissingContactsFoundationColumns < ActiveRecord::Migration[8.0]
  def up
    # Find the Contacts foundation
    foundation = execute("SELECT id FROM foundations WHERE name = 'Contacts'").first
    return unless foundation

    foundation_id = foundation['id']

    # Get the max position for Contact foundation columns
    max_position = execute("SELECT COALESCE(MAX(position), 0) as max_pos FROM columns WHERE foundation_id = #{foundation_id}").first['max_pos']
    next_position = max_position.to_i + 1

    # Define all 20 missing columns
    columns_to_add = [
      {
        name: 'TEEEM Rating',
        column_name: 'teeem_rating',
        column_type: 'number',
        description: 'TEEEM internal rating (0-5)',
        column_group: 'Performance Metrics',
        searchable: false
      },
      {
        name: 'ABN Valid',
        column_name: 'abn_valid',
        column_type: 'boolean',
        description: 'Whether ABN has been validated',
        column_group: 'Business Details',
        searchable: false
      },
      {
        name: 'ABN Entity Name',
        column_name: 'abn_entity_name',
        column_type: 'single_line_text',
        description: 'Entity name from ABN lookup',
        column_group: 'Business Details',
        searchable: true
      },
      {
        name: 'ABN Entity Type',
        column_name: 'abn_entity_type',
        column_type: 'single_line_text',
        description: 'Entity type from ABN lookup',
        column_group: 'Business Details',
        searchable: false
      },
      {
        name: 'ABN GST Registered',
        column_name: 'abn_gst_registered',
        column_type: 'boolean',
        description: 'Whether entity is GST registered',
        column_group: 'Business Details',
        searchable: false
      },
      {
        name: 'ABN Verified At',
        column_name: 'abn_verified_at',
        column_type: 'date_and_time',
        description: 'When ABN was last verified',
        column_group: 'Business Details',
        searchable: false
      },
      {
        name: 'Xero Synced',
        column_name: 'xero_synced',
        column_type: 'boolean',
        description: 'Whether contact is synced with Xero',
        column_group: 'Xero Integration',
        searchable: false
      },
      {
        name: "Driver's Licence",
        column_name: 'drivers_licence',
        column_type: 'single_line_text',
        description: "Driver's licence number",
        column_group: 'Personal Details',
        searchable: false
      },
      {
        name: 'Residential Address',
        column_name: 'residential_address',
        column_type: 'multiple_lines_text',
        description: 'Full residential address',
        column_group: 'Contact Information',
        searchable: true
      },
      {
        name: 'TFN',
        column_name: 'tfn',
        column_type: 'tfn',
        description: 'Tax File Number (XXX XXX XXX)',
        column_group: 'Tax Details',
        searchable: false
      },
      {
        name: 'Photo URL',
        column_name: 'photo_url',
        column_type: 'url',
        description: 'URL to profile photo',
        column_group: 'Personal Details',
        searchable: false
      },
      {
        name: 'Is Family Member',
        column_name: 'is_family_member',
        column_type: 'boolean',
        description: 'Whether contact is a family member',
        column_group: 'Personal Details',
        searchable: false
      },
      {
        name: 'Is Potential Director',
        column_name: 'is_potential_director',
        column_type: 'boolean',
        description: 'Whether contact is a potential director',
        column_group: 'Business Details',
        searchable: false
      },
      {
        name: 'Company Group ID',
        column_name: 'company_group_id',
        column_type: 'whole_number',
        description: 'Reference to company group',
        column_group: 'Business Details',
        searchable: false
      },
      {
        name: 'City',
        column_name: 'city',
        column_type: 'single_line_text',
        description: 'City name',
        column_group: 'Contact Information',
        searchable: true
      },
      {
        name: 'State',
        column_name: 'state',
        column_type: 'single_line_text',
        description: 'State or territory',
        column_group: 'Contact Information',
        searchable: true
      },
      {
        name: 'Postcode',
        column_name: 'postcode',
        column_type: 'postcode',
        description: 'Australian postcode (4 digits)',
        column_group: 'Contact Information',
        searchable: true
      },
      {
        name: 'Middle Name',
        column_name: 'middle_name',
        column_type: 'single_line_text',
        description: 'Middle name(s)',
        column_group: 'Personal Details',
        searchable: true
      },
      {
        name: 'Is Team Contact',
        column_name: 'is_team_contact',
        column_type: 'boolean',
        description: 'Whether contact is a team member',
        column_group: 'System',
        searchable: false
      }
    ]

    # Note: xero_contact_types was already added in migration 20251210013000_add_xero_contact_types_column_metadata.rb

    # Insert each column
    columns_to_add.each_with_index do |col, index|
      # Check if column already exists
      existing = execute("SELECT id FROM columns WHERE foundation_id = #{foundation_id} AND column_name = '#{col[:column_name]}'").first
      if existing
        puts "⏭️  Skipping #{col[:column_name]} - already exists"
        next
      end

      position = next_position + index

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
          '#{col[:name].gsub("'", "''")}',
          '#{col[:column_name]}',
          '#{col[:column_type]}',
          '#{col[:description].gsub("'", "''")}',
          #{col[:searchable]},
          false,
          false,
          false,
          #{position},
          '#{col[:column_group]}',
          NOW(),
          NOW()
        )
      SQL

      puts "✅ Added #{col[:column_name]} column metadata"
    end

    puts "\n🎉 Added #{columns_to_add.count} missing column metadata records to Contact foundation"
  end

  def down
    foundation = execute("SELECT id FROM foundations WHERE name = 'Contacts'").first
    return unless foundation

    foundation_id = foundation['id']

    # List of columns to remove
    columns_to_remove = %w[
      teeem_rating
      abn_valid
      abn_entity_name
      abn_entity_type
      abn_gst_registered
      abn_verified_at
      xero_synced
      drivers_licence
      residential_address
      tfn
      photo_url
      is_family_member
      is_potential_director
      company_group_id
      city
      state
      postcode
      middle_name
      is_team_contact
    ]

    columns_to_remove.each do |column_name|
      execute("DELETE FROM columns WHERE foundation_id = #{foundation_id} AND column_name = '#{column_name}'")
      puts "Removed #{column_name} column metadata"
    end
  end
end
