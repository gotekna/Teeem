# frozen_string_literal: true

# Creates a Foundation for XeroChartOfAccount model
# This enables TeeemTableView with saved views, filters, and column management
class CreateXeroChartOfAccountsFoundation < ActiveRecord::Migration[7.1]
  def up
    # Create Foundation record wrapping existing XeroChartOfAccount model
    foundation = Foundation.create!(
      name: "Xero Chart of Accounts",
      singular_name: "Xero Account",
      plural_name: "Xero Accounts",
      slug: "xero-chart-of-accounts",
      database_table_name: "xero_chart_of_accounts",
      table_type: "system",
      model_class: "XeroChartOfAccount",
      icon: "list",
      feature: "Xero",
      is_live: true,
      has_ui: true,
      has_saved_views: true,
      searchable: true,
      title_column: "account_code",
      allow_reserved_name: true
    )

    # Create columns matching the database schema
    columns = [
      {
        name: "Code",
        column_name: "account_code",
        column_type: "single_line_text",
        is_title: true,
        searchable: true,
        required: true,
        position: 1
      },
      {
        name: "Name",
        column_name: "account_name",
        column_type: "single_line_text",
        searchable: true,
        required: true,
        position: 2
      },
      {
        name: "Type",
        column_name: "account_type",
        column_type: "single_line_text",
        searchable: true,
        position: 3
      },
      {
        name: "Tax Type",
        column_name: "tax_type",
        column_type: "single_line_text",
        position: 4
      },
      {
        name: "Description",
        column_name: "description",
        column_type: "multiple_lines_text",
        position: 5
      },
      {
        name: "Active",
        column_name: "active",
        column_type: "boolean",
        position: 6
      }
    ]

    columns.each do |col_attrs|
      Column.create!(col_attrs.merge(foundation_id: foundation.id))
    end

    puts "Created Foundation ##{foundation.id} for XeroChartOfAccount with #{columns.size} columns"
  end

  def down
    foundation = Foundation.find_by(model_class: "XeroChartOfAccount")
    if foundation
      foundation.columns.destroy_all
      foundation.destroy
      puts "Removed Foundation for XeroChartOfAccount"
    end
  end
end
