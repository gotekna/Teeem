# frozen_string_literal: true

# Migration: Consolidate warehouse_folders as THE ONE SSoT
#
# Problem: warehouse_folders had a confusing split SSoT:
# - WAREHOUSE_ROOT_DEFAULTS (code) had default templates
# - warehouse_folders column (database) had only customizations
# - ensure_warehouse_folders callback merged both at runtime
#
# Solution: Database is THE ONE SSoT
# - Populate ALL warehouse_folders into database for every record
# - After this, no more runtime merging - database = truth
#
# SSoT: WarehouseProvider.warehouse_folders column is THE ONE place
# for all warehouse folder templates after this migration.
#
class PopulateWarehouseFoldersAsSsot < ActiveRecord::Migration[7.0]
  # Defaults copied from WarehouseProvider::WAREHOUSE_ROOT_DEFAULTS
  # This is a snapshot at migration time - subsequent code changes won't affect migrated data
  WAREHOUSE_ROOT_DEFAULTS = {
    'user' => 'Teeem Docs/{{UserName}}/{{Folder}}',
    'job' => 'Jobs/{{JobCode}}/{{TabName}}',
    'contact' => 'Contacts/{{ContactName}}/{{TabName}}',
    'corporate' => 'Corporate/{{CompanyGroup}}/{{CompanyCode}}/{{TabName}}',
    'task' => 'Tasks/{{TaskId}}/{{TaskName}}',
    'task_attachments' => 'Attachments',
    'task_responses' => 'Responses',
    'case' => 'Cases/{{CaseId}}',
    'case_documents' => 'Documents',
    'case_emails' => 'Emails',
    'asset' => 'Corporate/{{CompanyGroup}}/{{CompanyCode}}/Assets/{{AssetName}}',
    'asset_expenses' => 'Expenses',
    'asset_service' => 'Service',
    'asset_readings' => 'Readings',
    'compliance' => 'Jobs/{{JobCode}}/Compliance',
    'bank_statement' => 'Corporate/{{CompanyGroup}}/{{CompanyCode}}/XERO/Bank',
    'template' => 'Warehousing/Templates/{{TemplateType}}',
    'template_documents' => 'Templates/Documents',
    'template_bank_statements' => 'Templates/Bank Statements',
    'template_invoices' => 'Templates/Invoices',
    'template_email_signatures' => 'Templates/Email Signatures',
    'template_pdf_fields' => 'Templates/PDF Fields',
    'esignature' => 'Warehousing/E-Signatures/{{Year}}/{{Month}}',
    'esignature_pending' => 'Warehousing/E-Signatures/Pending',
    'esignature_completed' => 'Warehousing/E-Signatures/Completed',
    'plan' => 'Jobs/{{JobCode}}/Plans',
    'email' => 'Emails/{{Mailbox}}/{{Year}}/{{Month}}',
    'email_body' => 'Body',
    'email_attachments' => 'Attachments',
    'warehouse' => 'Warehousing/{{TabName}}',
    'chat' => 'Warehousing/Conversations/{{Context}}/{{Year}}/{{Month}}',
    'bill_inbox' => 'Warehousing/Bill Inbox/{{Status}}/{{Year}}/{{Month}}',
    'notebook' => 'Warehousing/Notebooks/{{UserName}}/{{NotebookName}}/{{Year}}'
  }.freeze

  def up
    say_with_time "Populating warehouse_folders for all WarehouseProvider records" do
      updated_count = 0

      # Use find_each for memory efficiency
      WarehouseProvider.find_each do |wp|
        # Merge: defaults first, then existing customizations override
        existing = wp.read_attribute(:warehouse_folders) || {}
        full_data = WAREHOUSE_ROOT_DEFAULTS.merge(existing)

        # Only update if different (avoid unnecessary writes)
        if wp.read_attribute(:warehouse_folders) != full_data
          wp.update_column(:warehouse_folders, full_data)
          updated_count += 1
        end
      end

      say "Updated #{updated_count} WarehouseProvider records with full warehouse_folders"
      updated_count
    end
  end

  def down
    # Reversing this migration is tricky - we can't know which values were customizations
    # vs defaults. Best approach: do nothing, the old callback will re-merge on initialize.
    say "Skipping rollback - after_initialize callback will handle merging if still present"
  end
end
