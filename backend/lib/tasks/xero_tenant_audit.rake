# frozen_string_literal: true

# FRC (Feb 2026): Fix cross-tenant invoice data leak
# Root cause: Xero invoices from one tenant's Xero org were imported with
# the wrong TEEEM tenant_id, causing them to appear in another tenant's views.
#
# Usage:
#   rails xero:tenant_audit              # Audit only (safe, no changes)
#   rails xero:tenant_audit:fix          # Fix misassigned invoices (dry run)
#   rails xero:tenant_audit:fix[execute] # Fix misassigned invoices (for real)

namespace :xero do
  namespace :tenant_audit do
    desc "Audit XeroCredential → Tenant mappings and find misassigned invoices"
    task audit: :environment do
      puts "=" * 70
      puts "XERO TENANT AUDIT"
      puts "=" * 70

      # Step 1: Show all XeroCredential → Tenant mappings
      puts "\n📋 XeroCredential → TEEEM Tenant Mappings:"
      puts "-" * 70
      XeroCredential.all.each do |cred|
        tenant = cred.teeem_tenant
        tenant_name = tenant&.name || "⚠️  NOT MAPPED"
        puts "  Xero Org: #{cred.tenant_name || 'unnamed'}"
        puts "    Xero UUID:      #{cred.tenant_id}"
        puts "    TEEEM Tenant:   #{tenant_name} (ID: #{cred.teeem_tenant_id || 'nil'})"
        puts "    Status:         #{cred.status}"
        puts "    Primary:        #{cred.is_primary}"
        puts ""
      end

      # Step 2: Show all TEEEM tenants
      puts "\n📋 TEEEM Tenants:"
      puts "-" * 70
      Tenant.all.each do |t|
        xero_creds = XeroCredential.where(teeem_tenant_id: t.id)
        puts "  #{t.name} (ID: #{t.id}, master: #{t.master_tenant?})"
        puts "    Xero orgs: #{xero_creds.map(&:tenant_name).join(', ').presence || 'none'}"
      end

      # Step 3: Find invoices by xero_org_id and check if tenant_id matches
      puts "\n📋 Invoice Distribution by Xero Org → TEEEM Tenant:"
      puts "-" * 70

      mismatches = []
      ExternalInvoice.unscoped
        .group(:xero_org_id, :tenant_id)
        .select("xero_org_id, tenant_id, COUNT(*) as cnt")
        .each do |row|
          xero_org_id = row.xero_org_id
          invoice_tenant_id = row.tenant_id
          count = row.cnt

          # Look up what tenant this Xero org SHOULD map to
          cred = XeroCredential.find_by(tenant_id: xero_org_id)
          expected_tenant_id = cred&.teeem_tenant_id
          expected_tenant_name = cred&.teeem_tenant&.name || "UNKNOWN"
          actual_tenant_name = Tenant.find_by(id: invoice_tenant_id)&.name || "UNKNOWN"
          xero_org_name = cred&.tenant_name || xero_org_id&.first(8)

          match_status = if expected_tenant_id.nil?
            "⚠️  NO MAPPING"
          elsif expected_tenant_id == invoice_tenant_id
            "✅"
          else
            "❌ MISMATCH"
          end

          puts "  Xero Org: #{xero_org_name}"
          puts "    Invoices: #{count}"
          puts "    Stored tenant:   #{actual_tenant_name} (ID: #{invoice_tenant_id})"
          puts "    Expected tenant: #{expected_tenant_name} (ID: #{expected_tenant_id || 'nil'})"
          puts "    Status: #{match_status}"
          puts ""

          if expected_tenant_id.present? && expected_tenant_id != invoice_tenant_id
            mismatches << {
              xero_org_id: xero_org_id,
              xero_org_name: xero_org_name,
              current_tenant_id: invoice_tenant_id,
              expected_tenant_id: expected_tenant_id,
              count: count
            }
          end
        end

      # Step 4: Summary
      if mismatches.any?
        puts "\n🚨 MISMATCHED INVOICES FOUND:"
        puts "-" * 70
        total = 0
        mismatches.each do |m|
          actual_name = Tenant.find_by(id: m[:current_tenant_id])&.name
          expected_name = Tenant.find_by(id: m[:expected_tenant_id])&.name
          puts "  #{m[:count]} invoices from #{m[:xero_org_name]}: #{actual_name} → should be #{expected_name}"
          total += m[:count]
        end
        puts "\n  Total misassigned: #{total}"
        puts "\n  To fix, run: rails xero:tenant_audit:fix[execute]"
      else
        puts "\n✅ All invoices correctly assigned to their tenant."
      end
    end

    desc "Fix misassigned invoices (pass 'execute' to apply, otherwise dry run)"
    task :fix, [:mode] => :environment do |_t, args|
      dry_run = args[:mode] != "execute"

      puts "=" * 70
      puts dry_run ? "XERO TENANT FIX (DRY RUN)" : "XERO TENANT FIX (EXECUTING)"
      puts "=" * 70

      fixed_count = 0

      # Find all xero_org_id → expected_tenant_id mappings
      XeroCredential.where.not(teeem_tenant_id: nil).each do |cred|
        xero_org_id = cred.tenant_id
        expected_tenant_id = cred.teeem_tenant_id
        xero_org_name = cred.tenant_name || xero_org_id.first(8)

        # Find invoices with wrong tenant_id for this xero org
        wrong_invoices = ExternalInvoice.unscoped
          .where(xero_org_id: xero_org_id)
          .where.not(tenant_id: expected_tenant_id)

        count = wrong_invoices.count
        next if count == 0

        actual_tenant_name = Tenant.find_by(id: wrong_invoices.first.tenant_id)&.name
        expected_tenant_name = Tenant.find_by(id: expected_tenant_id)&.name

        puts "\n  #{xero_org_name}: #{count} invoices"
        puts "    Moving: #{actual_tenant_name} → #{expected_tenant_name}"

        if dry_run
          puts "    (dry run - no changes made)"
        else
          # FRC: Unique constraint on (source, tenant_id, external_id) means we can't
          # just update_all - some invoices already exist in the target tenant.
          # Strategy: Delete duplicates that already exist in target, then move the rest.
          moved = 0
          deleted_dupes = 0

          wrong_invoices.find_each do |invoice|
            # Check if this invoice already exists in the target tenant
            existing = ExternalInvoice.unscoped.find_by(
              source: invoice.source,
              tenant_id: expected_tenant_id,
              external_id: invoice.external_id
            )

            if existing
              # Duplicate - delete the misassigned one (target already has it)
              invoice.destroy
              deleted_dupes += 1
            else
              # Safe to move - update tenant_id and clear contact_id
              invoice.update_columns(
                tenant_id: expected_tenant_id,
                contact_id: nil
              )
              moved += 1
            end
          end

          puts "    ✅ Moved #{moved}, deleted #{deleted_dupes} duplicates"
        end

        fixed_count += count
      end

      if fixed_count > 0
        puts "\n#{dry_run ? 'Would fix' : 'Fixed'}: #{fixed_count} invoices"
        puts "\nAfter fixing, run auto-match in each tenant's Xero settings to re-link contacts." unless dry_run
      else
        puts "\n✅ No misassigned invoices found."
      end
    end
  end

  desc "Audit Xero tenant mappings (shortcut)"
  task tenant_audit: "tenant_audit:audit"
end
