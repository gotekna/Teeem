# Sync Storage Configuration from staging to production
# Run with: rails sync_storage_config:apply

namespace :sync_storage_config do
  desc "Apply storage configuration from staging (Jan 2026)"
  task apply: :environment do
    ActsAsTenant.with_tenant(Organization.first) do
      puts "Syncing StorageConfiguration..."

      sc = StorageConfiguration.instance

      # SSoT: warehouse_folders paths (from staging Jan 2026)
      warehouse_folders = {
        "user" => "Teeem Docs/{{UserName}}/{{Folder}}",
        "job" => "Jobs/{{JobCode}}/{{TabName}}",
        "contact" => "Contacts/{{ContactName}}/{{TabName}}",
        "corporate" => "Corporate/{{CompanyGroup}}/{{CompanyCode}}/{{TabName}}",
        "task" => "Tasks/{{TaskId}}/{{TaskName}}",
        "task_attachments" => "Tasks/{{TaskId}}/{{TaskName}}/Attachments",
        "task_responses" => "Tasks/{{TaskId}}/{{TaskName}}/Responses",
        "case" => "Cases/{{CaseId}}",
        "case_documents" => "Cases/{{CaseId}}/Documents",
        "case_emails" => "Cases/{{CaseId}}/Emails",
        "asset" => "Assets/{{AssetName}}",
        "asset_expenses" => "Assets/{{AssetName}}/Expenses",
        "asset_service" => "Assets/{{AssetName}}/Service",
        "asset_readings" => "Assets/{{AssetName}}/Readings",
        "compliance" => "Jobs/{{JobCode}}/Compliance",
        "bank_statement" => "Corporate/{{CompanyGroup}}/{{CompanyCode}}/XERO/Bank",
        "template" => "Templates/{{TemplateType}}",
        "template_documents" => "Templates/Documents",
        "template_bank_statements" => "Templates/Bank Statements",
        "template_invoices" => "Templates/Invoices",
        "template_email_signatures" => "Templates/Email Signatures",
        "template_pdf_fields" => "Templates/PDF Fields",
        "esignature" => "ESignatures/{{Year}}/{{Month}}",
        "esignature_pending" => "ESignatures/Pending",
        "esignature_completed" => "ESignatures/Completed",
        "plan" => "Jobs/{{JobCode}}/Plans",
        "email" => "Emails/{{Mailbox}}/{{Year}}/{{Month}}",
        "email_body" => "Body",
        "email_attachments" => "Emails/{{Mailbox}}/{{Year}}/{{Month}}",
        "warehouse" => "Warehousing/{{TabName}}",
        "chat" => "Warehousing/Chat/{{Context}}/{{Year}}/{{Month}}",
        "bill_inbox" => "Warehousing/BillInbox/{{Status}}/{{Year}}/{{Month}}",
        "notebook" => "Warehousing/Notes/{{UserName}}/{{NotebookName}}/{{Year}}",
        "payment" => "Payments/{{Year}}/{{Month}}",
        "financial" => "Financials/{{Year}}",
        "payment_proof" => "Payments/{{Year}}/{{Month}}/Proof",
        "corporate_entity" => "Corporate/{{CompanyGroup}}/{{CompanyCode}}/{{TabName}}",
        "payment_invoices" => "Payments/{{Year}}/{{Month}}/Invoices",
        "financial_transactions" => "Financials/{{Year}}/{{Month}}"
      }

      sc.update!(warehouse_folders: warehouse_folders)
      puts "  Updated #{warehouse_folders.keys.count} warehouse_folders paths"

      # Fix EntityTab display names (match by tab_key since IDs may differ)
      puts "\nFixing EntityTab display names..."

      tab_fixes = {
        "chat" => { display_name: "Chat" },
        "bill-inbox" => { display_name: "Bill Inbox" }
      }

      tab_fixes.each do |tab_key, attrs|
        tab = EntityTab.find_by(tab_key: tab_key)
        if tab
          old_name = tab.display_name
          tab.update!(attrs)
          puts "  #{tab_key}: #{old_name.inspect} -> #{attrs[:display_name].inspect}"
        else
          puts "  #{tab_key}: NOT FOUND (may need to create)"
        end
      end

      puts "\nDone!"
    end
  end

  desc "Show current storage configuration"
  task show: :environment do
    ActsAsTenant.with_tenant(Organization.first) do
      sc = StorageConfiguration.instance
      puts "Current warehouse_folders:"
      puts sc.warehouse_folders.to_yaml
    end
  end
end
