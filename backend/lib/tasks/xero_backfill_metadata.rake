# frozen_string_literal: true

namespace :xero do
  desc "Backfill tenant and organization info in Xero WarehouseDocument metadata"
  task backfill_metadata: :environment do
    puts "Starting Xero metadata backfill..."

    # Get all Xero WarehouseDocuments
    xero_docs = WarehouseDocument.where(source_type: "xero")
    total = xero_docs.count
    puts "Found #{total} Xero WarehouseDocuments"

    # Cache XeroCredentials for lookup
    xero_credentials = XeroCredential.all.index_by(&:tenant_id)
    puts "Loaded #{xero_credentials.count} XeroCredentials"

    # Get default tenant and organization
    default_tenant = Tenant.first
    default_org = Organization.where(is_active: true).first

    updated = 0
    skipped = 0
    errors = 0

    xero_docs.find_each.with_index do |doc, index|
      begin
        metadata = doc.metadata || {}
        needs_update = false

        # Get the ExternalInvoice to find Xero tenant_id
        invoice = nil

        # Try 1: Get invoice from documentable association
        if doc.documentable_type == "ExternalInvoice" && doc.documentable_id.present?
          invoice = ExternalInvoice.find_by(id: doc.documentable_id)
        end

        # Try 2: Fall back to finding by invoice_number in metadata
        if invoice.nil? && metadata["invoice_number"].present?
          invoice = ExternalInvoice.find_by(invoice_number: metadata["invoice_number"])
        end

        if invoice
          xero_tenant_id = invoice.tenant_id
          xero_credential = xero_credentials[xero_tenant_id]

          # Add xero_tenant_id if missing
          if metadata["xero_tenant_id"].blank? && xero_tenant_id.present?
            metadata["xero_tenant_id"] = xero_tenant_id
            needs_update = true
          end

          # Add xero_tenant_name if missing
          if metadata["xero_tenant_name"].blank? && xero_credential&.tenant_name.present?
            metadata["xero_tenant_name"] = xero_credential.tenant_name
            needs_update = true
          end
        end

        # Add tenant info if missing (use doc.tenant_id or default)
        tenant = doc.tenant_id.present? ? Tenant.find_by(id: doc.tenant_id) : default_tenant
        if tenant
          if metadata["tenant_id"].blank?
            metadata["tenant_id"] = tenant.id
            needs_update = true
          end
          if metadata["tenant_name"].blank?
            metadata["tenant_name"] = tenant.name
            needs_update = true
          end
        end

        # Add organization info if missing
        org = tenant&.organizations&.where(is_active: true)&.first || default_org
        if org
          if metadata["organization_id"].blank?
            metadata["organization_id"] = org.id
            needs_update = true
          end
          if metadata["organization_name"].blank?
            metadata["organization_name"] = org.name
            needs_update = true
          end
        end

        if needs_update
          doc.update_column(:metadata, metadata)
          updated += 1
        else
          skipped += 1
        end

        # Progress
        if (index + 1) % 100 == 0
          puts "Progress: #{index + 1}/#{total} (updated: #{updated}, skipped: #{skipped})"
        end

      rescue => e
        errors += 1
        puts "Error on doc #{doc.id}: #{e.message}"
      end
    end

    puts "\nBackfill complete!"
    puts "  Total: #{total}"
    puts "  Updated: #{updated}"
    puts "  Skipped (already had data): #{skipped}"
    puts "  Errors: #{errors}"
  end

  desc "Check Xero WarehouseDocument metadata status"
  task check_metadata: :environment do
    xero_docs = WarehouseDocument.where(source_type: "xero")
    total = xero_docs.count

    with_xero_tenant = xero_docs.where("metadata->>'xero_tenant_id' IS NOT NULL").count
    with_xero_name = xero_docs.where("metadata->>'xero_tenant_name' IS NOT NULL").count
    with_tenant = xero_docs.where("metadata->>'tenant_id' IS NOT NULL").count
    with_org = xero_docs.where("metadata->>'organization_id' IS NOT NULL").count

    puts "Xero WarehouseDocuments Metadata Status:"
    puts "  Total documents: #{total}"
    puts ""
    puts "  With xero_tenant_id: #{with_xero_tenant} (#{(with_xero_tenant.to_f / total * 100).round(1)}%)"
    puts "  With xero_tenant_name: #{with_xero_name} (#{(with_xero_name.to_f / total * 100).round(1)}%)"
    puts "  With tenant_id: #{with_tenant} (#{(with_tenant.to_f / total * 100).round(1)}%)"
    puts "  With organization_id: #{with_org} (#{(with_org.to_f / total * 100).round(1)}%)"
    puts ""
    puts "  Missing xero_tenant_id: #{total - with_xero_tenant}"
    puts "  Missing organization_id: #{total - with_org}"

    # Sample one with and one without
    if total > 0
      sample_with = xero_docs.where("metadata->>'xero_tenant_id' IS NOT NULL").first
      sample_without = xero_docs.where("metadata->>'xero_tenant_id' IS NULL").first

      if sample_with
        puts "\nSample WITH xero_tenant_id (doc #{sample_with.id}):"
        puts "  #{sample_with.metadata.to_json}"
      end

      if sample_without
        puts "\nSample WITHOUT xero_tenant_id (doc #{sample_without.id}):"
        puts "  #{sample_without.metadata.to_json}"
      end
    end
  end
end
