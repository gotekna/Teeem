# frozen_string_literal: true

module Gl
  # Department for departmental P&L tracking
  class Department < ApplicationRecord
    self.table_name = "gl_departments"

    belongs_to :corporate_company, class_name: "Corporate"
    belongs_to :parent, class_name: "Gl::Department", optional: true
    belongs_to :manager, class_name: "User", optional: true

    has_many :children, class_name: "Gl::Department", foreign_key: :parent_id, dependent: :nullify
    has_many :invoices, class_name: "Gl::Invoice", dependent: :nullify
    has_many :journal_entries, class_name: "Gl::JournalEntry", dependent: :nullify
    has_many :split_lines, class_name: "Gl::SplitLine", dependent: :restrict_with_error

    validates :name, presence: true
    validates :code, uniqueness: { scope: :corporate_company_id }, allow_blank: true

    scope :active, -> { where(active: true) }
    scope :top_level, -> { where(parent_id: nil) }
    scope :ordered, -> { order(:position, :name) }

    # Get full hierarchy path
    def full_path
      path = [name]
      current = parent
      while current
        path.unshift(current.name)
        current = current.parent
      end
      path.join(" > ")
    end

    # Calculate P&L for a period
    def profit_loss(start_date:, end_date:)
      invoices_in_period = invoices.where(date: start_date..end_date)

      revenue = invoices_in_period.sales.sum(:total)
      expenses = invoices_in_period.bills.sum(:total)

      # Include journal entries
      journals = journal_entries.where(date: start_date..end_date)
      journal_revenue = journals.joins(:lines)
                                .where(gl_journal_lines: { account_id: revenue_account_ids })
                                .sum("gl_journal_lines.credit - gl_journal_lines.debit")
      journal_expenses = journals.joins(:lines)
                                 .where(gl_journal_lines: { account_id: expense_account_ids })
                                 .sum("gl_journal_lines.debit - gl_journal_lines.credit")

      total_revenue = revenue + journal_revenue
      total_expenses = expenses + journal_expenses
      profit = total_revenue - total_expenses

      {
        revenue: total_revenue,
        expenses: total_expenses,
        profit: profit,
        margin: total_revenue.positive? ? (profit / total_revenue * 100).round(2) : 0
      }
    end

    # Budget variance
    def budget_variance(start_date:, end_date:)
      return nil unless budget_amount

      actual = profit_loss(start_date: start_date, end_date: end_date)
      {
        budget: budget_amount,
        actual: actual[:profit],
        variance: actual[:profit] - budget_amount,
        variance_percent: ((actual[:profit] - budget_amount) / budget_amount * 100).round(2)
      }
    end

    # Tree structure for UI
    def self.tree(company)
      departments = company.gl_departments.active.includes(:children).ordered
      top_level = departments.select { |d| d.parent_id.nil? }

      top_level.map { |d| build_tree_node(d, departments) }
    end

    private

    def self.build_tree_node(dept, all_departments)
      children = all_departments.select { |d| d.parent_id == dept.id }
      {
        id: dept.id,
        name: dept.name,
        code: dept.code,
        children: children.map { |c| build_tree_node(c, all_departments) }
      }
    end

    def revenue_account_ids
      corporate_company.gl_accounts.where(account_type: "revenue").pluck(:id)
    end

    def expense_account_ids
      corporate_company.gl_accounts.where(account_type: "expense").pluck(:id)
    end
  end
end
