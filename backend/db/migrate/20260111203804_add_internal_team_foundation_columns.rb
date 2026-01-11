class AddInternalTeamFoundationColumns < ActiveRecord::Migration[8.0]
  def up
    jobs_foundation = Foundation.find_by(slug: 'jobs')
    contacts_foundation = Foundation.find_by(slug: 'contacts')

    return unless jobs_foundation && contacts_foundation

    # Get the lookup column type definition
    lookup_type = ColumnTypeDefinition.find_by(name: 'lookup')

    # Get position for new columns (after existing columns)
    max_position = Column.where(foundation_id: jobs_foundation.id).maximum(:position) || 0

    columns_to_create = [
      { column_name: 'supervisor_id', name: 'Supervisor', position: max_position + 1 },
      { column_name: 'site_coordinator_id', name: 'Site Coordinator', position: max_position + 2 },
      { column_name: 'estimator_id', name: 'Estimator', position: max_position + 3 },
      { column_name: 'internal_sales_id', name: 'Internal Sales', position: max_position + 4 },
      { column_name: 'client_coordinator_id', name: 'Client Coordinator', position: max_position + 5 },
    ]

    columns_to_create.each do |col_data|
      Column.create!(
        foundation_id: jobs_foundation.id,
        column_name: col_data[:column_name],
        name: col_data[:name],
        column_type: 'lookup',
        column_type_definition_id: lookup_type&.id,
        lookup_foundation_id: contacts_foundation.id,
        lookup_foundation_slug: 'contacts',
        lookup_display_column: 'display_name',
        position: col_data[:position],
        searchable: true,
        required: false
      )
    end

    # Remove legacy columns from Foundation
    Column.where(foundation_id: jobs_foundation.id, column_name: ['site_supervisor_name', 'site_supervisor_phone']).destroy_all
  end

  def down
    jobs_foundation = Foundation.find_by(slug: 'jobs')
    return unless jobs_foundation

    # Remove the new columns
    Column.where(
      foundation_id: jobs_foundation.id,
      column_name: ['supervisor_id', 'site_coordinator_id', 'estimator_id', 'internal_sales_id', 'client_coordinator_id']
    ).destroy_all

    # Re-add legacy columns (basic recreation - positions may differ)
    text_type = ColumnTypeDefinition.find_by(name: 'single_line_text')
    phone_type = ColumnTypeDefinition.find_by(name: 'phone')

    Column.create!(
      foundation_id: jobs_foundation.id,
      column_name: 'site_supervisor_name',
      name: 'Site Supervisor',
      column_type: 'single_line_text',
      column_type_definition_id: text_type&.id,
      searchable: true
    )

    Column.create!(
      foundation_id: jobs_foundation.id,
      column_name: 'site_supervisor_phone',
      name: 'Supervisor Phone',
      column_type: 'phone',
      column_type_definition_id: phone_type&.id,
      searchable: false
    )
  end
end
