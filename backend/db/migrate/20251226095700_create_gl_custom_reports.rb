# frozen_string_literal: true

class CreateGlCustomReports < ActiveRecord::Migration[7.2]
  def change
    # Custom report definitions
    create_table :gl_custom_reports do |t|
      t.references :corporate, null: false, foreign_key: true
      t.references :created_by, foreign_key: { to_table: :users }
      t.string :name, null: false
      t.text :description
      t.string :report_type, null: false, default: "table" # table, chart, pivot
      t.string :base_entity, null: false # invoices, payments, accounts, jobs, etc.
      t.string :category # finance, operations, custom
      t.boolean :is_public, default: false # Shared with all users
      t.boolean :is_template, default: false # Available as template
      t.jsonb :columns, default: [] # Selected columns/fields
      t.jsonb :filters, default: [] # Filter conditions
      t.jsonb :groupings, default: [] # Group by fields
      t.jsonb :aggregations, default: [] # Sum, avg, count, etc.
      t.jsonb :sort_order, default: [] # Sort configuration
      t.jsonb :chart_config, default: {} # Chart type and settings
      t.jsonb :formatting, default: {} # Column formatting, totals
      t.integer :usage_count, default: 0
      t.datetime :last_run_at
      t.timestamps
    end

    add_index :gl_custom_reports, :name
    add_index :gl_custom_reports, :report_type
    add_index :gl_custom_reports, :base_entity
    add_index :gl_custom_reports, :is_public
    add_index :gl_custom_reports, :is_template

    # Report columns (detailed field configuration)
    create_table :gl_report_columns do |t|
      t.references :custom_report, null: false, foreign_key: { to_table: :gl_custom_reports }
      t.string :field_path, null: false # e.g., "invoice.contact.name"
      t.string :display_name
      t.string :data_type # string, number, date, currency, boolean
      t.string :aggregation # sum, avg, min, max, count
      t.string :format # currency, percent, date_short, etc.
      t.integer :width
      t.integer :position, null: false
      t.boolean :visible, default: true
      t.boolean :sortable, default: true
      t.boolean :filterable, default: true
      t.jsonb :conditional_formatting, default: []
      t.timestamps
    end

    add_index :gl_report_columns, :position

    # Report filters
    create_table :gl_report_filters do |t|
      t.references :custom_report, null: false, foreign_key: { to_table: :gl_custom_reports }
      t.string :field_path, null: false
      t.string :operator, null: false # eq, ne, gt, lt, gte, lte, contains, starts_with, in, between
      t.jsonb :value # Can be single value, array, or range
      t.string :value_type # static, parameter, relative_date
      t.string :conjunction, default: "and" # and, or
      t.integer :position, null: false
      t.boolean :required, default: false
      t.boolean :user_editable, default: true # Can user change at runtime
      t.timestamps
    end

    add_index :gl_report_filters, :position

    # Saved report runs (results cache)
    create_table :gl_report_runs do |t|
      t.references :custom_report, null: false, foreign_key: { to_table: :gl_custom_reports }
      t.references :run_by, foreign_key: { to_table: :users }
      t.jsonb :parameters, default: {} # Runtime filter values
      t.integer :row_count
      t.decimal :execution_time, precision: 10, scale: 3 # seconds
      t.string :status, null: false, default: "pending" # pending, running, completed, failed
      t.text :error_message
      t.jsonb :summary_stats, default: {} # Totals, averages, etc.
      t.string :export_format # pdf, excel, csv
      t.string :export_file_id
      t.datetime :completed_at
      t.timestamps
    end

    add_index :gl_report_runs, :status
    add_index :gl_report_runs, :created_at

    # Report templates (pre-built reports)
    create_table :gl_report_templates do |t|
      t.string :name, null: false
      t.text :description
      t.string :category, null: false # finance, operations, compliance
      t.string :base_entity, null: false
      t.jsonb :definition, null: false # Full report configuration
      t.string :icon # Icon identifier
      t.boolean :active, default: true
      t.integer :usage_count, default: 0
      t.timestamps
    end

    add_index :gl_report_templates, :category
    add_index :gl_report_templates, :base_entity
    add_index :gl_report_templates, :active

    # Report favorites/bookmarks
    create_table :gl_report_favorites do |t|
      t.references :user, null: false, foreign_key: true
      t.references :custom_report, null: false, foreign_key: { to_table: :gl_custom_reports }
      t.integer :position
      t.timestamps
    end

    add_index :gl_report_favorites, [:user_id, :custom_report_id], unique: true

    # Report dashboards (collections of reports)
    create_table :gl_report_dashboards do |t|
      t.references :corporate, null: false, foreign_key: true
      t.references :created_by, foreign_key: { to_table: :users }
      t.string :name, null: false
      t.text :description
      t.boolean :is_default, default: false
      t.boolean :is_public, default: false
      t.jsonb :layout, default: [] # Widget positions and sizes
      t.timestamps
    end

    add_index :gl_report_dashboards, :is_default
    add_index :gl_report_dashboards, :is_public

    # Dashboard widgets (reports on a dashboard)
    create_table :gl_dashboard_widgets do |t|
      t.references :dashboard, null: false, foreign_key: { to_table: :gl_report_dashboards }
      t.references :custom_report, foreign_key: { to_table: :gl_custom_reports }
      t.string :widget_type, null: false # report, chart, kpi, text
      t.string :title
      t.jsonb :config, default: {} # Widget-specific configuration
      t.integer :row, null: false
      t.integer :col, null: false
      t.integer :width, null: false, default: 1
      t.integer :height, null: false, default: 1
      t.datetime :last_refreshed_at
      t.timestamps
    end

    add_index :gl_dashboard_widgets, [:row, :col]
  end
end
