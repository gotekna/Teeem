# frozen_string_literal: true

module Gl
  # Custom report builder with drag-drop field selection
  class CustomReport < ApplicationRecord
    self.table_name = "gl_custom_reports"

    REPORT_TYPES = %w[table chart pivot summary].freeze
    BASE_ENTITIES = %w[invoices bills payments accounts jobs contacts expenses time_entries].freeze
    CATEGORIES = %w[finance operations compliance custom].freeze

    belongs_to :corporate_company
    belongs_to :created_by, class_name: "User", optional: true

    has_many :report_columns, class_name: "Gl::ReportColumn", foreign_key: :custom_report_id, dependent: :destroy
    has_many :report_filters, class_name: "Gl::ReportFilter", foreign_key: :custom_report_id, dependent: :destroy
    has_many :report_runs, class_name: "Gl::ReportRun", foreign_key: :custom_report_id, dependent: :destroy
    has_many :favorites, class_name: "Gl::ReportFavorite", foreign_key: :custom_report_id, dependent: :destroy
    has_many :dashboard_widgets, class_name: "Gl::DashboardWidget", foreign_key: :custom_report_id, dependent: :nullify

    validates :name, presence: true
    validates :report_type, presence: true, inclusion: { in: REPORT_TYPES }
    validates :base_entity, presence: true, inclusion: { in: BASE_ENTITIES }

    scope :public_reports, -> { where(is_public: true) }
    scope :templates, -> { where(is_template: true) }
    scope :for_entity, ->(entity) { where(base_entity: entity) }
    scope :recent, -> { order(last_run_at: :desc) }
    scope :popular, -> { order(usage_count: :desc) }

    # Available fields for each entity
    ENTITY_FIELDS = {
      "invoices" => {
        "id" => { type: "number", label: "Invoice ID" },
        "number" => { type: "string", label: "Invoice Number" },
        "date" => { type: "date", label: "Invoice Date" },
        "due_date" => { type: "date", label: "Due Date" },
        "status" => { type: "string", label: "Status" },
        "subtotal" => { type: "currency", label: "Subtotal" },
        "tax" => { type: "currency", label: "Tax" },
        "total" => { type: "currency", label: "Total" },
        "amount_paid" => { type: "currency", label: "Amount Paid" },
        "amount_due" => { type: "currency", label: "Amount Due" },
        "contact.name" => { type: "string", label: "Customer Name" },
        "contact.email" => { type: "string", label: "Customer Email" },
        "job.name" => { type: "string", label: "Job Name" },
        "job.number" => { type: "string", label: "Job Number" },
        "created_at" => { type: "datetime", label: "Created At" }
      },
      "bills" => {
        "id" => { type: "number", label: "Bill ID" },
        "number" => { type: "string", label: "Bill Number" },
        "date" => { type: "date", label: "Bill Date" },
        "due_date" => { type: "date", label: "Due Date" },
        "status" => { type: "string", label: "Status" },
        "total" => { type: "currency", label: "Total" },
        "amount_paid" => { type: "currency", label: "Amount Paid" },
        "contact.name" => { type: "string", label: "Supplier Name" },
        "created_at" => { type: "datetime", label: "Created At" }
      },
      "payments" => {
        "id" => { type: "number", label: "Payment ID" },
        "date" => { type: "date", label: "Payment Date" },
        "amount" => { type: "currency", label: "Amount" },
        "payment_type" => { type: "string", label: "Payment Type" },
        "reference" => { type: "string", label: "Reference" },
        "contact.name" => { type: "string", label: "Contact Name" },
        "account.name" => { type: "string", label: "Account" }
      },
      "accounts" => {
        "id" => { type: "number", label: "Account ID" },
        "code" => { type: "string", label: "Account Code" },
        "name" => { type: "string", label: "Account Name" },
        "account_type" => { type: "string", label: "Account Type" },
        "balance" => { type: "currency", label: "Balance" },
        "status" => { type: "string", label: "Status" }
      },
      "jobs" => {
        "id" => { type: "number", label: "Job ID" },
        "number" => { type: "string", label: "Job Number" },
        "name" => { type: "string", label: "Job Name" },
        "status" => { type: "string", label: "Status" },
        "budget_amount" => { type: "currency", label: "Budget" },
        "actual_cost" => { type: "currency", label: "Actual Cost" },
        "revenue" => { type: "currency", label: "Revenue" },
        "profit" => { type: "currency", label: "Profit" },
        "profit_margin" => { type: "percent", label: "Profit Margin" },
        "contact.name" => { type: "string", label: "Customer Name" },
        "start_date" => { type: "date", label: "Start Date" },
        "end_date" => { type: "date", label: "End Date" }
      },
      "contacts" => {
        "id" => { type: "number", label: "Contact ID" },
        "name" => { type: "string", label: "Name" },
        "email" => { type: "string", label: "Email" },
        "phone" => { type: "string", label: "Phone" },
        "contact_type" => { type: "string", label: "Type" },
        "outstanding_balance" => { type: "currency", label: "Outstanding Balance" },
        "credit_limit" => { type: "currency", label: "Credit Limit" },
        "created_at" => { type: "datetime", label: "Created At" }
      },
      "expenses" => {
        "id" => { type: "number", label: "Expense ID" },
        "expense_date" => { type: "date", label: "Expense Date" },
        "expense_type" => { type: "string", label: "Expense Type" },
        "description" => { type: "string", label: "Description" },
        "cost_amount" => { type: "currency", label: "Cost Amount" },
        "billable_amount" => { type: "currency", label: "Billable Amount" },
        "markup_amount" => { type: "currency", label: "Markup" },
        "status" => { type: "string", label: "Status" },
        "job.name" => { type: "string", label: "Job Name" },
        "user.name" => { type: "string", label: "Employee" }
      },
      "time_entries" => {
        "id" => { type: "number", label: "Entry ID" },
        "entry_date" => { type: "date", label: "Date" },
        "hours" => { type: "number", label: "Hours" },
        "description" => { type: "string", label: "Description" },
        "billable_amount" => { type: "currency", label: "Billable Amount" },
        "status" => { type: "string", label: "Status" },
        "job.name" => { type: "string", label: "Job Name" },
        "user.name" => { type: "string", label: "Employee" },
        "rate.name" => { type: "string", label: "Rate Name" }
      }
    }.freeze

    # Get available fields for this report's entity
    def available_fields
      ENTITY_FIELDS[base_entity] || {}
    end

    # Create from template
    def self.from_template(template, company, user)
      definition = template.definition.with_indifferent_access
      report = create!(
        corporate_company: company,
        created_by: user,
        name: "#{template.name} Copy",
        description: template.description,
        report_type: definition[:report_type] || "table",
        base_entity: template.base_entity,
        category: template.category,
        columns: definition[:columns] || [],
        filters: definition[:filters] || [],
        groupings: definition[:groupings] || [],
        aggregations: definition[:aggregations] || [],
        sort_order: definition[:sort_order] || [],
        chart_config: definition[:chart_config] || {},
        formatting: definition[:formatting] || {}
      )

      template.increment!(:usage_count)
      report
    end

    # Run the report and return results
    def run!(user: nil, parameters: {})
      run = report_runs.create!(
        run_by: user,
        parameters: parameters,
        status: "running"
      )

      begin
        start_time = Time.current
        results = execute_query(parameters)

        run.update!(
          status: "completed",
          row_count: results[:rows].count,
          execution_time: Time.current - start_time,
          summary_stats: results[:summary],
          completed_at: Time.current
        )

        update!(last_run_at: Time.current)
        increment!(:usage_count)

        results
      rescue StandardError => e
        run.update!(status: "failed", error_message: e.message)
        raise
      end
    end

    # Execute the query
    def execute_query(parameters = {})
      query = build_query(parameters)
      rows = query.to_a

      {
        rows: rows.map { |r| format_row(r) },
        columns: effective_columns,
        summary: calculate_summary(rows),
        total_count: rows.count
      }
    end

    # Export to format
    def export!(format, user: nil, parameters: {})
      run = report_runs.create!(
        run_by: user,
        parameters: parameters,
        status: "running",
        export_format: format
      )

      begin
        results = execute_query(parameters)
        file_data = generate_export(format, results)

        run.update!(
          status: "completed",
          row_count: results[:rows].count,
          completed_at: Time.current
        )

        file_data
      rescue StandardError => e
        run.update!(status: "failed", error_message: e.message)
        raise
      end
    end

    # Duplicate report
    def duplicate!(user)
      new_report = dup
      new_report.name = "#{name} (Copy)"
      new_report.created_by = user
      new_report.is_public = false
      new_report.is_template = false
      new_report.usage_count = 0
      new_report.last_run_at = nil
      new_report.save!

      report_columns.each do |col|
        new_report.report_columns.create!(col.attributes.except("id", "custom_report_id", "created_at", "updated_at"))
      end

      report_filters.each do |filter|
        new_report.report_filters.create!(filter.attributes.except("id", "custom_report_id", "created_at", "updated_at"))
      end

      new_report
    end

    private

    def build_query(parameters)
      # Start with base entity
      query = base_model.where(corporate_company: corporate_company)

      # Apply includes for nested fields
      includes = columns.filter_map { |c| c.split(".").first.to_sym if c.include?(".") }.uniq
      query = query.includes(includes) if includes.present?

      # Apply filters
      filters.each do |filter|
        query = apply_filter(query, filter, parameters)
      end

      # Apply sorting
      if sort_order.present?
        sort_order.each do |sort|
          field = sort["field"]
          direction = sort["direction"] == "desc" ? :desc : :asc
          query = query.order(field => direction)
        end
      else
        query = query.order(created_at: :desc)
      end

      query
    end

    def base_model
      case base_entity
      when "invoices" then Gl::Invoice.sales
      when "bills" then Gl::Invoice.bills
      when "payments" then Gl::Payment
      when "accounts" then Gl::Account
      when "jobs" then Job
      when "contacts" then Contact
      when "expenses" then Gl::BillableExpense
      when "time_entries" then Gl::BillableTimeEntry
      else raise "Unknown entity: #{base_entity}"
      end
    end

    def apply_filter(query, filter, parameters)
      field = filter["field"]
      operator = filter["operator"]
      value = resolve_filter_value(filter, parameters)

      return query if value.nil? && operator != "is_null" && operator != "is_not_null"

      case operator
      when "eq" then query.where(field => value)
      when "ne" then query.where.not(field => value)
      when "gt" then query.where("#{field} > ?", value)
      when "lt" then query.where("#{field} < ?", value)
      when "gte" then query.where("#{field} >= ?", value)
      when "lte" then query.where("#{field} <= ?", value)
      when "contains" then query.where("#{field} ILIKE ?", "%#{value}%")
      when "starts_with" then query.where("#{field} ILIKE ?", "#{value}%")
      when "in" then query.where(field => Array(value))
      when "between" then query.where(field => value.first..value.last)
      when "is_null" then query.where(field => nil)
      when "is_not_null" then query.where.not(field => nil)
      else query
      end
    end

    def resolve_filter_value(filter, parameters)
      case filter["value_type"]
      when "parameter"
        parameters[filter["value"]]
      when "relative_date"
        calculate_relative_date(filter["value"])
      else
        filter["value"]
      end
    end

    def calculate_relative_date(relative)
      case relative
      when "today" then Date.current
      when "yesterday" then Date.current - 1.day
      when "this_week" then Date.current.beginning_of_week
      when "last_week" then (Date.current - 1.week).beginning_of_week
      when "this_month" then Date.current.beginning_of_month
      when "last_month" then (Date.current - 1.month).beginning_of_month
      when "this_quarter" then Date.current.beginning_of_quarter
      when "last_quarter" then (Date.current - 3.months).beginning_of_quarter
      when "this_year" then Date.current.beginning_of_year
      when "last_year" then (Date.current - 1.year).beginning_of_year
      else Date.current
      end
    end

    def effective_columns
      if report_columns.present?
        report_columns.visible.order(:position).map do |col|
          {
            field: col.field_path,
            label: col.display_name,
            type: col.data_type,
            format: col.format,
            width: col.width
          }
        end
      else
        columns.map do |field|
          field_info = available_fields[field] || {}
          {
            field: field,
            label: field_info[:label] || field.humanize,
            type: field_info[:type] || "string"
          }
        end
      end
    end

    def format_row(record)
      effective_columns.to_h do |col|
        value = extract_field_value(record, col[:field])
        [col[:field], format_value(value, col[:type], col[:format])]
      end
    end

    def extract_field_value(record, field_path)
      parts = field_path.split(".")
      value = record
      parts.each do |part|
        break if value.nil?
        value = value.try(part)
      end
      value
    end

    def format_value(value, type, format = nil)
      return nil if value.nil?

      case type
      when "currency"
        value.to_f
      when "date"
        value.respond_to?(:strftime) ? value.strftime("%Y-%m-%d") : value
      when "datetime"
        value.respond_to?(:strftime) ? value.strftime("%Y-%m-%d %H:%M") : value
      when "percent"
        value.to_f
      else
        value
      end
    end

    def calculate_summary(rows)
      summary = {}

      aggregations.each do |agg|
        field = agg["field"]
        operation = agg["operation"]
        values = rows.map { |r| extract_field_value(r, field) }.compact

        summary[field] = case operation
                         when "sum" then values.sum(&:to_f)
                         when "avg" then values.any? ? values.sum(&:to_f) / values.size : 0
                         when "min" then values.min
                         when "max" then values.max
                         when "count" then values.size
                         else nil
                         end
      end

      summary
    end

    def generate_export(format, results)
      case format
      when "csv"
        generate_csv(results)
      when "excel"
        generate_excel(results)
      else
        generate_csv(results)
      end
    end

    def generate_csv(results)
      require "csv"

      CSV.generate do |csv|
        # Header row
        csv << results[:columns].map { |c| c[:label] }

        # Data rows
        results[:rows].each do |row|
          csv << results[:columns].map { |c| row[c[:field]] }
        end
      end
    end

    def generate_excel(results)
      # Simplified - would use a gem like caxlsx in production
      generate_csv(results)
    end
  end
end
