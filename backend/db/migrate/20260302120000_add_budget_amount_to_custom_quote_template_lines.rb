# frozen_string_literal: true

class AddBudgetAmountToCustomQuoteTemplateLines < ActiveRecord::Migration[7.1]
  def change
    add_column :custom_quote_template_lines, :budget_amount, :decimal, precision: 12, scale: 2
  end
end
