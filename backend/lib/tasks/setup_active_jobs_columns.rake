namespace :trapid do
  desc "Setup columns for Active Jobs table (ID 204) from constructions database table"
  task setup_active_jobs_columns: :environment do
    table_id = 204

    puts "Setting up columns for Active Jobs table (ID #{table_id})"

    # Delete existing columns
    existing_count = Column.where(table_id: table_id).count
    if existing_count > 0
      Column.where(table_id: table_id).destroy_all
      puts "Deleted #{existing_count} existing column definitions"
    end

    # Column definitions mapping constructions table to Gold Standard column types
    # Format: [column_name, display_name, column_type, position, options]
    columns_config = [
      # Action buttons - first column for quick actions
      ['actions', 'Actions', 'action_buttons', 0, {}],

      # Primary identifier
      ['title', 'Job Title', 'single_line_text', 1, { is_title: true, searchable: true }],

      # Financial columns
      ['contract_value', 'Contract Value', 'currency', 2, {}],
      ['live_profit', 'Live Profit', 'currency', 3, {}],
      ['profit_percentage', 'Profit %', 'percentage', 4, {}],

      # Status/Stage
      ['stage', 'Stage', 'choice', 5, {}],
      ['status', 'Status', 'choice', 6, {}],

      # Job identifiers
      ['ted_number', 'TED Number', 'single_line_text', 7, { searchable: true }],
      ['certifier_job_no', 'Certifier Job No', 'single_line_text', 8, { searchable: true }],

      # Dates
      ['start_date', 'Start Date', 'date', 9, {}],

      # Site supervisor info
      ['site_supervisor_name', 'Site Supervisor', 'single_line_text', 10, { searchable: true }],
      ['site_supervisor_email', 'Supervisor Email', 'email', 11, {}],
      ['site_supervisor_phone', 'Supervisor Phone', 'phone', 12, {}],

      # Design info
      ['design_name', 'Design', 'single_line_text', 13, {}],

      # Location
      ['latitude', 'Latitude', 'number', 14, {}],
      ['longitude', 'Longitude', 'number', 15, {}],
      ['location', 'Location', 'single_line_text', 16, { searchable: true }],

      # Counts
      ['purchase_orders_count', 'PO Count', 'whole_number', 17, {}],

      # OneDrive integration
      ['onedrive_folder_creation_status', 'OneDrive Status', 'choice', 18, {}],
      ['onedrive_folders_created_at', 'OneDrive Created', 'date_and_time', 19, {}],

      # System timestamps
      ['created_at', 'Created', 'date_and_time', 20, {}],
      ['updated_at', 'Updated', 'date_and_time', 21, {}],
    ]

    created_count = 0
    columns_config.each do |col|
      column_name, display_name, column_type, position, options = col
      options ||= {}

      Column.create!(
        table_id: table_id,
        column_name: column_name,
        name: display_name,
        column_type: column_type,
        position: position,
        is_title: options[:is_title] || false,
        searchable: options[:searchable] || false
      )
      puts "  Created: #{display_name} (#{column_name}) - #{column_type}"
      created_count += 1
    end

    puts "\nCreated #{created_count} column definitions for Active Jobs table"
    puts "\nColumn types used:"
    Column.where(table_id: table_id).group(:column_type).count.each do |type, count|
      puts "  #{type}: #{count}"
    end

    puts "\nDone! Test at: /tables/active-jobs"
  end
end
