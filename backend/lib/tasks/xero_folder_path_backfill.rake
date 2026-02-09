# frozen_string_literal: true

# Backfill folder_path on ExternalInvoice warehouse_documents
#
# ⚠️ DO NOT SIMPLIFY - Per-invoice Xero org resolution (Feb 2026 FRC)
# ════════════════════════════════════════════════════════════════════
# Why: Tenants can have MULTIPLE Xero orgs (e.g., Tekna Homes + W2G Assets).
#      The old code cached ONE credential per tenant, which is non-deterministic
#      when multiple XeroCredentials share the same teeem_tenant_id.
#      This caused bills to appear under the wrong org folder.
#
# ❌ WRONG: XeroCredential.find_by(teeem_tenant_id: tenant.id) → random org
# ✅ CORRECT: invoice.xero_org_id → XeroCredential.find_by(tenant_id: uuid) → exact org
# ════════════════════════════════════════════════════════════════════
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

    # Cache xero_org_id (UUID) → tenant_name to avoid N+1 queries at scale.
    # Keyed by Xero UUID (deterministic), NOT teeem_tenant_id (non-deterministic).
    # With 10,000 clients × ~3 orgs each = ~30,000 entries max.
    xero_org_name_cache = {}

    # Process per-tenant to satisfy ActsAsTenant and WarehouseProvider
    Tenant.find_each do |tenant|
      ActsAsTenant.with_tenant(tenant) do
        docs = WarehouseDocument.where(
          documentable_type: "ExternalInvoice",
          source_type: "xero",
          tenant_id: tenant.id
        ).includes(:linkable, documentable: :contact)

        tenant_count = docs.count
        next if tenant_count.zero?

        puts "\nTenant: #{tenant.name} (#{tenant_count} docs)"

        docs.find_each do |doc|
          total += 1

          invoice = doc.documentable
          # For contact name: prefer invoice.contact, fall back to doc.linkable
          contact = invoice&.contact || doc.linkable
          contact = nil unless contact.is_a?(Contact) if contact.present?

          unless contact
            skipped += 1
            next
          end

          # Use display_name directly (NOT document_folder_name which includes "Contacts/" prefix)
          # The "Contacts" root segment is already added in the parts array below
          contact_name = SharePoint::FilenameSanitizer.sanitize_path_segment(
            contact.display_name || "Unknown"
          )

          unless contact_name.present?
            skipped += 1
            next
          end

          # Resolve Xero org name PER INVOICE using xero_org_id (SSoT)
          # Priority chain: invoice.xero_org_id → raw_data → document metadata
          # Handles orphaned docs (nil documentable) via metadata fallback
          xero_org_uuid = invoice&.xero_org_id.presence ||
                          invoice&.raw_data&.dig("TenantId").presence ||
                          doc.metadata&.dig("xero_tenant_id").presence
          xero_org = nil
          if xero_org_uuid.present?
            xero_org = xero_org_name_cache[xero_org_uuid] ||= begin
              XeroCredential.find_by(tenant_id: xero_org_uuid)&.tenant_name
            end
          end

          # Get DocumentType from metadata
          doc_type_id = doc.metadata&.dig("document_type_id")
          document_type = doc_type_id.present? ? DocumentType.find_by(id: doc_type_id) : nil

          # Fall back to looking up by invoice type (same logic as XeroAttachmentSyncService)
          unless document_type
            invoice_type = invoice&.invoice_type || doc.metadata&.dig("invoice_type")
            type_name = case invoice_type
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
    puts "Xero orgs resolved: #{xero_org_name_cache.size} unique"
    puts "=" * 70
  end
end
