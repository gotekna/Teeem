# frozen_string_literal: true

# Register the 11 new tender detail columns in the Jobs Foundation so they appear in the API
# and can be used in TeeemTableView.
class RegisterTenderDetailFoundationColumns < ActiveRecord::Migration[8.0]
  def up
    jobs_foundation = Foundation.find_by(slug: 'jobs')
    return unless jobs_foundation

    last_position = jobs_foundation.columns.maximum(:position) || 0

    columns_config = [
      { column_name: "estate",                  column_type: "single_line_text", name: "Estate" },
      { column_name: "facade",                  column_type: "single_line_text", name: "Facade" },
      { column_name: "developer_approval",      column_type: "boolean",          name: "Developer Approval" },
      { column_name: "developer_contact",       column_type: "single_line_text", name: "Developer Contact" },
      { column_name: "land_registration",       column_type: "single_line_text", name: "Land Registration" },
      { column_name: "building_contract_type",  column_type: "single_line_text", name: "Building Contract Type" },
      { column_name: "development_application", column_type: "single_line_text", name: "Development Application" },
      { column_name: "sales_centre",            column_type: "single_line_text", name: "Sales Centre" },
      { column_name: "wind_classification",     column_type: "single_line_text", name: "Wind Classification" },
      { column_name: "soil_classification",     column_type: "single_line_text", name: "Soil Classification" },
      { column_name: "specification",           column_type: "single_line_text", name: "Specification" },
    ]

    columns_config.each_with_index do |config, idx|
      Column.find_or_create_by!(foundation_id: jobs_foundation.id, column_name: config[:column_name]) do |col|
        col.name = config[:name]
        col.column_type = config[:column_type]
        col.position = last_position + idx + 1
        col.searchable = false
        col.has_ui = true
        col.required = false
      end
    end

    puts "  Registered #{columns_config.size} tender detail columns on Jobs Foundation"
  end

  def down
    jobs_foundation = Foundation.find_by(slug: 'jobs')
    return unless jobs_foundation

    column_names = %w[
      estate facade developer_approval developer_contact land_registration
      building_contract_type development_application sales_centre
      wind_classification soil_classification specification
    ]

    Column.where(foundation_id: jobs_foundation.id, column_name: column_names).destroy_all
  end
end
