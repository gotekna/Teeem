# frozen_string_literal: true

# Tenant Compulsory Config Tasks
# ================================
# Bulk-mark TEEEM master config records as compulsory for new tenant provisioning.
#
# Usage:
#   rails tenant:mark_all_compulsory          # Mark all records in all sync tables
#   rails tenant:mark_all_compulsory[dry_run] # Preview without changes
#   rails tenant:compulsory_status            # Show current compulsory counts

namespace :tenant do
  desc "Mark all TEEEM master config records as compulsory for new tenant provisioning"
  task :mark_all_compulsory, [:mode] => :environment do |_t, args|
    dry_run = args[:mode] == "dry_run"

    puts "=" * 60
    puts dry_run ? "DRY RUN: Previewing compulsory marking" : "Marking all TEEEM config records as compulsory"
    puts "=" * 60

    master = Tenant.find_by(is_master_tenant: true) || Tenant.find_by(slug: "teeem")
    unless master
      puts "ERROR: No master tenant found"
      exit 1
    end

    puts "Master tenant: #{master.name} (ID: #{master.id})"
    puts ""

    total_marked = 0
    total_skipped = 0

    TenantConfigSyncService::CONFIG_TABLES.each do |table_key, config|
      model = config[:model].constantize

      # Get all records for master tenant
      records = ActsAsTenant.with_tenant(master) { model.all.to_a }

      if records.empty?
        puts "  #{config[:model].ljust(35)} 0 records (skipped)"
        next
      end

      # Check existing compulsory preferences
      existing = TenantSyncPreference.where(
        tenant: master,
        configurable_type: config[:model],
        sync_mode: "compulsory"
      ).pluck(:configurable_id).to_set

      new_count = 0
      skip_count = 0

      records.each do |record|
        if existing.include?(record.id)
          skip_count += 1
        else
          unless dry_run
            TenantSyncPreference.set_mode(record, "compulsory", tenant: master)
          end
          new_count += 1
        end
      end

      total_marked += new_count
      total_skipped += skip_count

      status = new_count > 0 ? "MARKED" : "unchanged"
      puts "  #{config[:model].ljust(35)} #{records.length} records: #{new_count} newly marked, #{skip_count} already compulsory [#{status}]"
    end

    puts ""
    puts "-" * 60
    puts "Total: #{total_marked} newly marked, #{total_skipped} already compulsory"
    puts dry_run ? "DRY RUN complete - no changes made" : "Done!"
  end

  desc "Show current compulsory record counts per sync table"
  task compulsory_status: :environment do
    puts "=" * 60
    puts "Compulsory Config Status"
    puts "=" * 60

    master = Tenant.find_by(is_master_tenant: true) || Tenant.find_by(slug: "teeem")
    unless master
      puts "ERROR: No master tenant found"
      exit 1
    end

    puts "Master tenant: #{master.name} (ID: #{master.id})"
    puts ""
    puts "  #{'Table'.ljust(35)} #{'Total'.rjust(6)} #{'Compulsory'.rjust(12)} #{'Choice'.rjust(8)} #{'Unmarked'.rjust(10)}"
    puts "  #{'-' * 71}"

    TenantConfigSyncService::CONFIG_TABLES.each do |table_key, config|
      model = config[:model].constantize

      total = ActsAsTenant.with_tenant(master) { model.count }
      compulsory = TenantSyncPreference.compulsory.where(
        tenant: master,
        configurable_type: config[:model]
      ).count
      choice = TenantSyncPreference.choice.where(
        tenant: master,
        configurable_type: config[:model]
      ).count
      unmarked = total - compulsory - choice

      status = if total == 0
        ""
      elsif compulsory == total
        "ALL"
      elsif compulsory == 0 && choice == 0
        "NONE"
      else
        "PARTIAL"
      end

      puts "  #{config[:model].ljust(35)} #{total.to_s.rjust(6)} #{compulsory.to_s.rjust(12)} #{choice.to_s.rjust(8)} #{unmarked.to_s.rjust(10)}  #{status}"
    end
  end
end
