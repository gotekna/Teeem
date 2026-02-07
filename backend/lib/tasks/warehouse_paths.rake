# frozen_string_literal: true

namespace :warehouse do
  namespace :paths do
    desc "Backfill folder_path for all documents (async batched)"
    task backfill: :environment do
      tenant_id = ENV["TENANT_ID"]&.to_i

      unmaterialized = WarehouseDocument.where(folder_path: nil)
      unmaterialized = unmaterialized.where(tenant_id: tenant_id) if tenant_id
      total = unmaterialized.count

      if total.zero?
        puts "All documents already have materialized paths!"
        next
      end

      puts "Starting backfill for #{total} documents#{tenant_id ? " (tenant##{tenant_id})" : ""}..."
      BackfillWarehousePathsJob.perform_later(tenant_id)
      puts "Backfill job queued. Check logs for progress."
    end

    desc "Backfill folder_path synchronously (for development/testing)"
    task backfill_sync: :environment do
      tenant_id = ENV["TENANT_ID"]&.to_i

      scope = WarehouseDocument.where(folder_path: nil).order(:id)
      scope = scope.where(tenant_id: tenant_id) if tenant_id
      total = scope.count

      if total.zero?
        puts "All documents already have materialized paths!"
        next
      end

      puts "Backfilling #{total} documents synchronously..."

      computer = WarehousePathComputer.new
      updated = 0
      errors = 0

      scope.find_each(batch_size: 500) do |doc|
        result = computer.compute(doc)
        doc.update_columns(
          folder_path: result[:folder_path],
          warehouse_folder_id: result[:warehouse_folder_id],
          path_template_version: result[:path_template_version],
          updated_at: Time.current
        )
        updated += 1
        print "\r  #{updated}/#{total} (#{(updated * 100.0 / total).round(1)}%)" if (updated % 100).zero?
      rescue StandardError => e
        errors += 1
        puts "\n  Error for doc##{doc.id}: #{e.message}"
      end

      puts "\n\nDone! #{updated} updated, #{errors} errors"
    end

    desc "Reconcile stale paths (find and fix mismatches)"
    task reconcile: :environment do
      tenant_id = ENV["TENANT_ID"]&.to_i

      puts "Running reconciliation..."
      if tenant_id
        ReconcileWarehousePathsJob.perform_now(tenant_id)
      else
        ReconcileWarehousePathsJob.perform_now
      end
      puts "Reconciliation complete. Check logs for details."
    end

    desc "Re-backfill ALL documents (force recompute, not just nil paths)"
    task rebackfill_all: :environment do
      tenant_id = ENV["TENANT_ID"]&.to_i

      scope = WarehouseDocument.order(:id)
      scope = scope.where(tenant_id: tenant_id) if tenant_id
      total = scope.count

      if total.zero?
        puts "No documents found!"
        next
      end

      puts "Re-backfilling ALL #{total} documents#{tenant_id ? " (tenant##{tenant_id})" : ""}..."
      puts "This will OVERWRITE existing folder_path values with FK-driven paths."
      puts ""

      computer = WarehousePathComputer.new
      updated = 0
      errors = 0
      error_details = Hash.new(0)
      started_at = Time.current

      scope.find_each(batch_size: 500) do |doc|
        result = computer.compute(doc)
        doc.update_columns(
          folder_path: result[:folder_path],
          warehouse_folder_id: result[:warehouse_folder_id],
          path_template_version: result[:path_template_version],
          updated_at: Time.current
        )
        updated += 1
        if (updated % 1000).zero?
          elapsed = Time.current - started_at
          rate = updated / elapsed
          eta = ((total - updated) / rate).round
          print "\r  #{updated}/#{total} (#{(updated * 100.0 / total).round(1)}%) - #{rate.round(0)}/s - ETA: #{eta}s  "
        end
      rescue StandardError => e
        errors += 1
        error_details[e.class.name] += 1
        puts "\n  Error for doc##{doc.id}: #{e.message}" if errors <= 10
      end

      elapsed = (Time.current - started_at).round(1)
      puts "\n\nDone in #{elapsed}s!"
      puts "  Updated: #{updated}"
      puts "  Errors:  #{errors}"
      if error_details.any?
        puts "  Error breakdown:"
        error_details.each { |klass, count| puts "    #{klass}: #{count}" }
      end

      # Print path distribution summary
      puts "\nPath distribution after rebackfill:"
      WarehouseDocument.where.not(folder_path: nil)
        .group(Arel.sql("split_part(folder_path, '/', 1)"))
        .count
        .sort_by { |_, v| -v }
        .first(15)
        .each { |segment, count| puts "  #{segment}: #{count}" }

      # Check for generic root-only paths
      generic_count = WarehouseDocument.where(warehouse_folder_id: nil).count
      puts "\nDocs without warehouse_folder_id: #{generic_count} (#{total.zero? ? 0 : (generic_count * 100.0 / total).round(1)}%)"
    end

    desc "Show materialization stats"
    task stats: :environment do
      total = WarehouseDocument.count
      materialized = WarehouseDocument.where.not(folder_path: nil).count
      unmaterialized = total - materialized

      with_folder_id = WarehouseDocument.where.not(warehouse_folder_id: nil).count

      puts "Warehouse Path Materialization Stats"
      puts "=" * 40
      puts "Total documents:       #{total}"
      puts "Materialized paths:    #{materialized} (#{total.zero? ? 0 : (materialized * 100.0 / total).round(1)}%)"
      puts "Unmaterialized:        #{unmaterialized}"
      puts "With folder FK:        #{with_folder_id}"
      puts ""

      # Stale count (path_template_version < warehouse_folder.template_version)
      stale = WarehouseDocument.left_joins(:warehouse_folder).where(
        "warehouse_folders.template_version IS NOT NULL " \
        "AND warehouse_documents.path_template_version < warehouse_folders.template_version"
      ).count
      puts "Stale paths:           #{stale}"

      # Top-level path distribution
      puts "\nTop-level path distribution:"
      WarehouseDocument.where.not(folder_path: nil)
        .group(Arel.sql("split_part(folder_path, '/', 1)"))
        .count
        .sort_by { |_, v| -v }
        .first(10)
        .each { |segment, count| puts "  #{segment}: #{count}" }
    end
  end
end
