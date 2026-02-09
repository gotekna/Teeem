# frozen_string_literal: true

# Backfill folder_path on ExternalInvoice warehouse_documents
#
# FRC (Feb 2026): XeroAttachmentSyncService was computing the correct folder path
# via compute_folder_from_document_type() but never passing it to WarehouseDocumentCreator.
# The materialize_folder_path callback fell back to root "contact" template, producing
# truncated paths like "Contacts/7 Eleven" instead of "Contacts/7 Eleven/Financial/Tekna/Bills".
#
# Usage:
#   rails xero:backfill_folder_paths          # Dry run (shows what would change)
#   rails xero:backfill_folder_paths[execute]  # Apply changes

namespace :xero do
  desc "Backfill folder_path on ExternalInvoice warehouse_documents (dry run by default)"
  task :backfill_folder_paths, [:mode] => :environment do |_t, args|
    execute = args[:mode] == "execute"

    puts "=" * 70
    puts execute ? "EXECUTING folder_path backfill" : "DRY RUN - pass [execute] to apply"
    puts "=" * 70

    total = 0
    updated = 0
    skipped = 0
    errors = 0

    # Process per-tenant to satisfy ActsAsTenant and WarehouseProvider
    Tenant.find_each do |tenant|
      ActsAsTenant.with_tenant(tenant) do
        docs = WarehouseDocument.where(
          documentable_type: "ExternalInvoice",
          source_type: "xero",
          tenant_id: tenant.id
        ).includes(documentable: :contact)

        tenant_count = docs.count
        next if tenant_count.zero?

        puts "\nTenant: #{tenant.name} (#{tenant_count} docs)"

        # Cache Xero org name for this tenant
        credential = XeroCredential.find_by(teeem_tenant_id: tenant.id)
        xero_org = credential&.tenant_name

        docs.find_each do |doc|
          total += 1

          invoice = doc.documentable
          unless invoice
            skipped += 1
            next
          end

          contact = invoice.contact
          unless contact
            skipped += 1
            next
          end

          # Use display_name directly (NOT document_folder_name which includes "Contacts/" prefix)
          # The "Contacts" root segment is already added in the parts array below
          contact_name = SharePoint::FilenameSanitizer.sanitize_path_segment(
            contact.display_name || contact.name || "Unknown"
          )

          unless contact_name.present?
            skipped += 1
            next
          end

          # Get DocumentType from metadata
          doc_type_id = doc.metadata&.dig("document_type_id")
          document_type = doc_type_id.present? ? DocumentType.find_by(id: doc_type_id) : nil

          # Fall back to looking up by invoice type (same logic as XeroAttachmentSyncService)
          unless document_type
            type_name = case invoice.invoice_type
                        when "bill" then "Xero Bill"
                        when "credit_note" then "Xero Credit Note"
                        else "Xero Invoice"
                        end
            document_type = DocumentType.find_by(name: type_name)
          end

          doc_folder = document_type&.folder.presence ||
                       document_type&.primary_tab.presence ||
                       "Documents"

          # Build correct folder path (same logic as compute_folder_from_document_type)
          parts = ["Contacts", contact_name, "Financial"]
          parts << xero_org if xero_org.present?
          parts << doc_folder
          new_folder_path = parts.compact.join("/")

          # Check if path actually needs updating
          if doc.folder_path == new_folder_path
            skipped += 1
            next
          end

          old_path = doc.folder_path || "(null)"

          if execute
            begin
              doc.update_column(:folder_path, new_folder_path)
              updated += 1
              puts "  FIXED #{doc.id}: #{old_path} -> #{new_folder_path}"
            rescue StandardError => e
              errors += 1
              puts "  ERROR #{doc.id}: #{e.message}"
            end
          else
            updated += 1
            puts "  WOULD FIX #{doc.id}: #{old_path} -> #{new_folder_path}"
          end
        end
      end
    end

    puts "\n" + "-" * 70
    puts "Total: #{total} | #{execute ? 'Updated' : 'Would update'}: #{updated} | Skipped: #{skipped} | Errors: #{errors}"
    puts "=" * 70
  end
end
