# frozen_string_literal: true

module Gl
  # Pre-built report templates
  class ReportTemplate < ApplicationRecord
    self.table_name = "gl_report_templates"

    CATEGORIES = %w[finance operations compliance custom].freeze
    BASE_ENTITIES = Gl::CustomReport::BASE_ENTITIES

    validates :name, presence: true
    validates :category, presence: true, inclusion: { in: CATEGORIES }
    validates :base_entity, presence: true, inclusion: { in: BASE_ENTITIES }
    validates :definition, presence: true

    scope :active, -> { where(active: true) }
    scope :for_category, ->(cat) { where(category: cat) }
    scope :for_entity, ->(entity) { where(base_entity: entity) }
    scope :popular, -> { order(usage_count: :desc) }

    # Seed default templates
    def self.seed_defaults!
      templates = [
        {
          name: "Aged Receivables",
          description: "Outstanding invoices grouped by age (30/60/90+ days)",
          category: "finance",
          base_entity: "invoices",
          icon: "clock",
          definition: {
            report_type: "table",
            columns: %w[number date due_date contact.name total amount_paid amount_due],
            filters: [
              { field: "status", operator: "ne", value: "paid" },
              { field: "invoice_type", operator: "eq", value: "sales" }
            ],
            groupings: [],
            aggregations: [
              { field: "total", operation: "sum" },
              { field: "amount_due", operation: "sum" }
            ],
            sort_order: [{ field: "due_date", direction: "asc" }]
          }
        },
        {
          name: "Monthly Revenue Summary",
          description: "Revenue by month with comparison to prior year",
          category: "finance",
          base_entity: "invoices",
          icon: "trending-up",
          definition: {
            report_type: "chart",
            columns: %w[date total],
            filters: [
              { field: "invoice_type", operator: "eq", value: "sales" },
              { field: "status", operator: "in", value: %w[authorised paid] }
            ],
            groupings: ["date"],
            aggregations: [{ field: "total", operation: "sum" }],
            chart_config: { type: "bar", group_by: "month" }
          }
        },
        {
          name: "Job Profitability",
          description: "Profit analysis by job with margin calculations",
          category: "operations",
          base_entity: "jobs",
          icon: "pie-chart",
          definition: {
            report_type: "table",
            columns: %w[number name contact.name budget_amount actual_cost revenue profit profit_margin],
            filters: [],
            aggregations: [
              { field: "budget_amount", operation: "sum" },
              { field: "actual_cost", operation: "sum" },
              { field: "revenue", operation: "sum" },
              { field: "profit", operation: "sum" }
            ],
            sort_order: [{ field: "profit_margin", direction: "desc" }]
          }
        },
        {
          name: "Outstanding Bills",
          description: "Unpaid supplier bills by due date",
          category: "finance",
          base_entity: "bills",
          icon: "file-text",
          definition: {
            report_type: "table",
            columns: %w[number date due_date contact.name total amount_paid],
            filters: [
              { field: "status", operator: "ne", value: "paid" }
            ],
            aggregations: [{ field: "total", operation: "sum" }],
            sort_order: [{ field: "due_date", direction: "asc" }]
          }
        },
        {
          name: "Expense Report",
          description: "Billable expenses by job and employee",
          category: "operations",
          base_entity: "expenses",
          icon: "receipt",
          definition: {
            report_type: "table",
            columns: %w[expense_date expense_type description job.name user.name cost_amount billable_amount status],
            filters: [],
            aggregations: [
              { field: "cost_amount", operation: "sum" },
              { field: "billable_amount", operation: "sum" }
            ],
            sort_order: [{ field: "expense_date", direction: "desc" }]
          }
        },
        {
          name: "Time Billing Summary",
          description: "Billable hours by employee and job",
          category: "operations",
          base_entity: "time_entries",
          icon: "clock",
          definition: {
            report_type: "table",
            columns: %w[entry_date user.name job.name description hours billable_amount status],
            filters: [],
            groupings: ["user.name"],
            aggregations: [
              { field: "hours", operation: "sum" },
              { field: "billable_amount", operation: "sum" }
            ],
            sort_order: [{ field: "entry_date", direction: "desc" }]
          }
        },
        {
          name: "Trial Balance",
          description: "Account balances for verification",
          category: "compliance",
          base_entity: "accounts",
          icon: "scale",
          definition: {
            report_type: "table",
            columns: %w[code name account_type balance],
            filters: [{ field: "status", operator: "eq", value: "active" }],
            aggregations: [{ field: "balance", operation: "sum" }],
            sort_order: [{ field: "code", direction: "asc" }]
          }
        },
        {
          name: "Payment History",
          description: "All payments received and made",
          category: "finance",
          base_entity: "payments",
          icon: "credit-card",
          definition: {
            report_type: "table",
            columns: %w[date payment_type contact.name reference amount account.name],
            filters: [],
            aggregations: [{ field: "amount", operation: "sum" }],
            sort_order: [{ field: "date", direction: "desc" }]
          }
        }
      ]

      templates.each do |template|
        find_or_create_by!(name: template[:name]) do |t|
          t.assign_attributes(template)
        end
      end
    end
  end
end
