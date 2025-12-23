# frozen_string_literal: true

# Migration: Link financial reports to DocumentType SSoT
# This allows report display_name and file_name to be generated from DocumentType templates
class AddDocumentTypeToFinancialReports < ActiveRecord::Migration[7.2]
  def change
    # Add document_type_id to all financial report tables
    add_reference :profit_loss_reports, :document_type, foreign_key: true, null: true
    add_reference :balance_sheet_reports, :document_type, foreign_key: true, null: true
    add_reference :bank_statement_reports, :document_type, foreign_key: true, null: true
  end
end
