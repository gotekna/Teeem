jobs_table = Table.find_by(database_table_name: 'jobs')
job_types_table = Table.find_by(database_table_name: 'job_types')
job_statuses_table = Table.find_by(database_table_name: 'job_status')

# First, add columns for job_types table if needed
unless job_types_table.columns.exists?(column_name: 'name')
  Column.create!(
    table_id: job_types_table.id,
    name: 'Name',
    column_name: 'name',
    column_type: 'single_line_text',
    position: 1,
    required: true,
    is_title: true
  )
  puts 'Created name column for job_types'
end

unless job_types_table.columns.exists?(column_name: 'position')
  Column.create!(
    table_id: job_types_table.id,
    name: 'Position',
    column_name: 'position',
    column_type: 'whole_number',
    position: 2,
    required: false
  )
  puts 'Created position column for job_types'
end

unless job_types_table.columns.exists?(column_name: 'is_active')
  Column.create!(
    table_id: job_types_table.id,
    name: 'Active',
    column_name: 'is_active',
    column_type: 'boolean',
    position: 3,
    required: false
  )
  puts 'Created is_active column for job_types'
end

# Add columns for job_statuses table if needed
unless job_statuses_table.columns.exists?(column_name: 'name')
  Column.create!(
    table_id: job_statuses_table.id,
    name: 'Name',
    column_name: 'name',
    column_type: 'single_line_text',
    position: 1,
    required: true,
    is_title: true
  )
  puts 'Created name column for job_statuses'
end

unless job_statuses_table.columns.exists?(column_name: 'position')
  Column.create!(
    table_id: job_statuses_table.id,
    name: 'Position',
    column_name: 'position',
    column_type: 'whole_number',
    position: 2,
    required: false
  )
  puts 'Created position column for job_statuses'
end

unless job_statuses_table.columns.exists?(column_name: 'is_active')
  Column.create!(
    table_id: job_statuses_table.id,
    name: 'Active',
    column_name: 'is_active',
    column_type: 'boolean',
    position: 3,
    required: false
  )
  puts 'Created is_active column for job_statuses'
end

unless job_statuses_table.columns.exists?(column_name: 'color')
  Column.create!(
    table_id: job_statuses_table.id,
    name: 'Color',
    column_name: 'color',
    column_type: 'single_line_text',
    position: 4,
    required: false
  )
  puts 'Created color column for job_statuses'
end

# Now add the lookup columns to jobs table
max_pos = jobs_table.columns.maximum(:position) || 0

# Create Job Type column
unless jobs_table.columns.exists?(column_name: 'job_type_id')
  Column.create!(
    table_id: jobs_table.id,
    name: 'Job Type',
    column_name: 'job_type_id',
    column_type: 'lookup',
    lookup_table_id: job_types_table.id,
    lookup_display_column: 'name',
    position: max_pos + 1,
    required: false
  )
  puts 'Created job_type_id column for jobs'
end

# Create Job Status column
unless jobs_table.columns.exists?(column_name: 'job_status_id')
  Column.create!(
    table_id: jobs_table.id,
    name: 'Job Status',
    column_name: 'job_status_id',
    column_type: 'lookup',
    lookup_table_id: job_statuses_table.id,
    lookup_display_column: 'name',
    position: max_pos + 2,
    required: false
  )
  puts 'Created job_status_id column for jobs'
end

puts 'Done!'
