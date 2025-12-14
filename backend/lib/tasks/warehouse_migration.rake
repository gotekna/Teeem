# frozen_string_literal: true

namespace :warehouse do
  desc "Migrate ContactExternalLink data to WarehouseContact"
  task migrate_contact_links: :environment do
    puts "=" * 60
    puts "Migrating ContactExternalLink data to WarehouseContact"
    puts "=" * 60

    links_migrated = 0
    links_skipped = 0
    warehouse_created = 0
    errors = []

    ContactExternalLink.find_each do |link|
      begin
        # Find or create WarehouseContact for this Xero contact
        warehouse_contact = WarehouseContact.find_by(
          xero_id: link.external_contact_id,
          tenant_id: link.tenant_id
        )

        if warehouse_contact.nil?
          # WarehouseContact doesn't exist - create a minimal one from the link
          warehouse_contact = WarehouseContact.create!(
            xero_id: link.external_contact_id,
            tenant_id: link.tenant_id,
            source: link.source,
            name: link.contact&.display_name,
            email_address: link.contact&.email,
            contact_id: link.contact_id,
            sync_enabled: link.sync_enabled,
            sync_direction: link.sync_direction,
            sync_error: link.sync_error,
            conflict_fields: link.conflict_fields || {},
            match_type: link.match_type,
            match_confidence: link.match_confidence,
            needs_review: link.needs_review,
            reviewed_at: link.reviewed_at,
            reviewed_by: link.reviewed_by,
            last_synced_at: link.last_synced_at
          )
          warehouse_created += 1
          puts "  Created WarehouseContact #{warehouse_contact.id} for ContactExternalLink #{link.id}"
        elsif warehouse_contact.contact_id.nil?
          # WarehouseContact exists but isn't linked - copy the link
          warehouse_contact.update!(
            contact_id: link.contact_id,
            sync_enabled: link.sync_enabled,
            sync_direction: link.sync_direction,
            sync_error: link.sync_error,
            conflict_fields: link.conflict_fields || {},
            match_type: link.match_type || "migrated",
            match_confidence: link.match_confidence,
            needs_review: link.needs_review,
            reviewed_at: link.reviewed_at,
            reviewed_by: link.reviewed_by
          )
          links_migrated += 1
          puts "  Migrated ContactExternalLink #{link.id} to WarehouseContact #{warehouse_contact.id}"
        else
          # Already linked - skip
          links_skipped += 1
        end
      rescue StandardError => e
        error_msg = "Error migrating link #{link.id}: #{e.message}"
        puts "  ERROR: #{error_msg}"
        errors << error_msg
      end
    end

    puts ""
    puts "=" * 60
    puts "Migration Complete"
    puts "=" * 60
    puts "Links migrated: #{links_migrated}"
    puts "WarehouseContacts created: #{warehouse_created}"
    puts "Links skipped (already linked): #{links_skipped}"
    puts "Errors: #{errors.count}"
    errors.each { |e| puts "  - #{e}" } if errors.any?
  end

  desc "Backfill warehouse_contact_id on existing WarehouseBankTransactions"
  task backfill_bank_transaction_contacts: :environment do
    puts "=" * 60
    puts "Backfilling warehouse_contact_id on WarehouseBankTransactions"
    puts "=" * 60

    updated = 0
    skipped = 0
    not_found = 0

    WarehouseBankTransaction.where(warehouse_contact_id: nil).where.not(xero_contact_id: nil).find_each do |txn|
      warehouse_contact = WarehouseContact.find_by(xero_id: txn.xero_contact_id, tenant_id: txn.tenant_id)

      if warehouse_contact
        txn.update_column(:warehouse_contact_id, warehouse_contact.id)
        updated += 1
      else
        not_found += 1
      end
    end

    skipped = WarehouseBankTransaction.where(xero_contact_id: nil).count

    puts ""
    puts "=" * 60
    puts "Backfill Complete"
    puts "=" * 60
    puts "Updated: #{updated}"
    puts "WarehouseContact not found: #{not_found}"
    puts "Skipped (no xero_contact_id): #{skipped}"
  end

  desc "Backfill warehouse_contact_id on existing ExternalInvoices"
  task backfill_invoice_contacts: :environment do
    puts "=" * 60
    puts "Backfilling warehouse_contact_id on ExternalInvoices"
    puts "=" * 60

    updated = 0
    skipped = 0
    not_found = 0

    ExternalInvoice.where(warehouse_contact_id: nil).where.not(external_contact_id: nil).find_each do |invoice|
      warehouse_contact = WarehouseContact.find_by(xero_id: invoice.external_contact_id, tenant_id: invoice.tenant_id)

      if warehouse_contact
        invoice.update_column(:warehouse_contact_id, warehouse_contact.id)
        updated += 1
      else
        not_found += 1
      end
    end

    skipped = ExternalInvoice.where(external_contact_id: nil).count

    puts ""
    puts "=" * 60
    puts "Backfill Complete"
    puts "=" * 60
    puts "Updated: #{updated}"
    puts "WarehouseContact not found: #{not_found}"
    puts "Skipped (no external_contact_id): #{skipped}"
  end

  desc "Run all warehouse migration tasks"
  task migrate_all: :environment do
    puts "Running all warehouse migration tasks..."
    puts ""

    Rake::Task["warehouse:migrate_contact_links"].invoke
    puts ""
    Rake::Task["warehouse:backfill_bank_transaction_contacts"].invoke
    puts ""
    Rake::Task["warehouse:backfill_invoice_contacts"].invoke
    puts ""

    puts "=" * 60
    puts "All warehouse migrations complete!"
    puts "=" * 60
  end

  desc "Show warehouse migration status"
  task status: :environment do
    puts "=" * 60
    puts "Warehouse Migration Status"
    puts "=" * 60
    puts ""

    puts "WarehouseContact:"
    puts "  Total: #{WarehouseContact.count}"
    puts "  Linked to TEEEM Contact: #{WarehouseContact.linked.count}"
    puts "  Unlinked: #{WarehouseContact.unlinked.count}"
    puts ""

    puts "ContactExternalLink (legacy):"
    puts "  Total: #{ContactExternalLink.count}"
    puts ""

    puts "WarehouseBankTransaction:"
    total_txns = WarehouseBankTransaction.count
    with_contact = WarehouseBankTransaction.where.not(warehouse_contact_id: nil).count
    puts "  Total: #{total_txns}"
    puts "  With warehouse_contact_id: #{with_contact}"
    puts "  Without warehouse_contact_id: #{total_txns - with_contact}"
    puts ""

    puts "ExternalInvoice:"
    total_invoices = ExternalInvoice.count
    with_contact = ExternalInvoice.where.not(warehouse_contact_id: nil).count
    puts "  Total: #{total_invoices}"
    puts "  With warehouse_contact_id: #{with_contact}"
    puts "  Without warehouse_contact_id: #{total_invoices - with_contact}"
    puts ""

    puts "Contact (TEEEM):"
    puts "  Total: #{Contact.count}"
    puts "  With xero_id (deprecated): #{Contact.where.not(xero_id: nil).count}"
  end
end
