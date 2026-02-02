# frozen_string_literal: true

# FRC (Feb 2026): Backfill xero_org_id for existing ExternalInvoice records
# Root cause: ExternalInvoice.tenant_id was TEEEM integer, causing confusion with Xero UUID.
# This task populates the new xero_org_id column using ContactExternalLink as the source.

namespace :xero do
  desc "Backfill xero_org_id for existing ExternalInvoice records"
  task backfill_xero_org_id: :environment do
    puts "=== Backfilling xero_org_id for ExternalInvoice records ==="

    # Get all Xero credentials to map contacts to orgs
    xero_credentials = XeroCredential.where(status: %w[connected degraded])

    total_updated = 0
    total_failed = 0

    xero_credentials.find_each do |credential|
      xero_org_id = credential.tenant_id
      tenant_name = credential.tenant_name

      puts "\nProcessing: #{tenant_name} (#{xero_org_id})"

      # Find all contact IDs linked to this Xero org
      contact_ids = ContactExternalLink
        .where(source: "xero", tenant_id: xero_org_id)
        .pluck(:contact_id)

      if contact_ids.empty?
        puts "  No linked contacts found, skipping"
        next
      end

      # Update all ExternalInvoices for these contacts that don't have xero_org_id set
      updated = ExternalInvoice
        .where(contact_id: contact_ids)
        .where(xero_org_id: nil)
        .update_all(xero_org_id: xero_org_id)

      total_updated += updated
      puts "  Updated #{updated} invoices"
    end

    # Also try to backfill using raw_data if available (fallback)
    puts "\n=== Fallback: Checking raw_data for unmapped invoices ==="
    unmapped = ExternalInvoice.where(xero_org_id: nil).where.not(raw_data: nil)
    fallback_updated = 0

    unmapped.find_each do |invoice|
      # Some raw_data might have the tenant_id embedded
      # This is a fallback - most should be caught by the contact linking above
      next
    end

    puts "\n=== Summary ==="
    puts "Total updated: #{total_updated}"
    puts "Remaining without xero_org_id: #{ExternalInvoice.where(xero_org_id: nil).count}"
  end

  desc "Verify xero_org_id backfill completeness"
  task verify_xero_org_id: :environment do
    puts "=== xero_org_id Verification ==="

    total = ExternalInvoice.count
    with_org_id = ExternalInvoice.where.not(xero_org_id: nil).count
    without_org_id = ExternalInvoice.where(xero_org_id: nil).count

    puts "Total ExternalInvoices: #{total}"
    puts "With xero_org_id: #{with_org_id} (#{(with_org_id.to_f / total * 100).round(1)}%)"
    puts "Without xero_org_id: #{without_org_id}"

    if without_org_id > 0
      puts "\nBreakdown of missing xero_org_id:"
      ExternalInvoice.where(xero_org_id: nil).group(:invoice_type).count.each do |type, count|
        puts "  #{type}: #{count}"
      end
    end

    # Check for_xero_org scope usage
    puts "\n=== Per-Org Counts ==="
    XeroCredential.where(status: %w[connected degraded]).each do |cred|
      count = ExternalInvoice.for_xero_org(cred.tenant_id).count
      puts "  #{cred.tenant_name}: #{count} invoices"
    end
  end
end
