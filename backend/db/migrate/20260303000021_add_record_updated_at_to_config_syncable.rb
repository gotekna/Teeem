# frozen_string_literal: true

class AddRecordUpdatedAtToConfigSyncable < ActiveRecord::Migration[7.1]
  TABLES = %w[
    bpmn_processes claim_invoice_templates claim_stage_template_lines
    claim_stage_templates colour_selection_templates contact_types contacts
    cost_centres custom_quote_templates document_templates document_types
    email_templates folder_templates invoice_templates job_stages
    job_status_stages job_statuses job_tabs job_type_statuses job_types
    meeting_types plan_categories plan_types po_statuses po_template_items
    po_template_packs price_histories pricebook_brands pricebook_categories
    pricebook_ranges pricebooks public_holidays quantity_variables
    quote_templates recipe_categories recipes sm_canonical_records
    sm_hold_reasons sm_resources sm_schedule_master_document_types
    sm_schedule_master_templates sm_schedule_masters sm_stages sm_task_groups
    sm_tasks sm_trades specification_templates supervisor_checklist_templates
    takeoff_templates tender_headers tenders warehouse_folder_document_types
    warehouse_folders warehouse_types whs_induction_templates
    whs_inspection_templates xero_chart_of_accounts
  ].freeze

  def up
    TABLES.each do |table|
      add_column table, :record_updated_at, :datetime
      execute "UPDATE #{table} SET record_updated_at = updated_at WHERE record_updated_at IS NULL"
    end
  end

  def down
    TABLES.each { |table| remove_column table, :record_updated_at }
  end
end
