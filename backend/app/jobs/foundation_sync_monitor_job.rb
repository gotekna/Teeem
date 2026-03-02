# Daily job to monitor Foundation sync health and auto-fix drift
# Run via: FoundationSyncMonitorJob.perform_later
# Schedule in config/solid_queue_recurring.yml
#
# FRC (Feb 2026): Changed from alert-only to self-healing. Previously sent
# Sentry warnings daily without fixing, causing 9+ unresolved alerts.
# Now auto-syncs safe foundations and only alerts on failures.

class FoundationSyncMonitorJob < ApplicationJob
  include DeduplicatableJob
  queue_as :default

  # Foundations that need manual review (skip auto-sync)
  SKIP_FOUNDATIONS = [
    "Trinity Bible",
    "Trinity Teacher",
    "Trinity Lexicon",
    "User Management",
    "Gold Standard Reference"
  ].freeze

  def perform
    Rails.logger.info "[FoundationSyncMonitor] Starting daily sync check..."

    # Get all foundations with sync issues
    issues = find_sync_issues

    if issues.empty?
      Rails.logger.info "[FoundationSyncMonitor] All foundations in sync"
      return
    end

    total_orphans = issues.sum { |i| i[:orphans].count }
    total_missing = issues.sum { |i| i[:missing].count }

    Rails.logger.info "[FoundationSyncMonitor] Drift detected: #{issues.count} foundations, #{total_orphans} orphans, #{total_missing} phantom"

    # Auto-sync safe foundations
    auto_fixed = auto_sync_drift(issues)

    # Re-check for remaining issues after auto-sync
    # Exclude SKIP_FOUNDATIONS — they are intentionally excluded from auto-sync
    # and will never be auto-fixable, so alerting on them daily is noise.
    remaining = find_sync_issues.reject { |i| SKIP_FOUNDATIONS.include?(i[:foundation].name) }

    if remaining.empty?
      Rails.logger.info "[FoundationSyncMonitor] Auto-sync resolved all drift: #{auto_fixed[:added]} added, #{auto_fixed[:removed]} removed"
      return
    end

    # Only alert Sentry for issues that couldn't be auto-fixed (and aren't intentionally skipped)
    remaining_orphans = remaining.sum { |i| i[:orphans].count }
    remaining_missing = remaining.sum { |i| i[:missing].count }

    Rails.logger.warn "[FoundationSyncMonitor] #{remaining.count} foundations still out of sync after auto-fix"

    if defined?(Sentry)
      Sentry.capture_message(
        "Foundation metadata drift (#{remaining.count} foundations need manual review)",
        level: :warning,
        extra: {
          auto_fixed: auto_fixed,
          foundations_remaining: remaining.count,
          orphaned_columns: remaining_orphans,
          phantom_columns: remaining_missing,
          details: remaining.map { |i|
            {
              foundation: i[:foundation].name,
              orphans: i[:orphans],
              missing: i[:missing]
            }
          }
        }
      )
    end
  end

  private

  def find_sync_issues
    issues = []

    Foundation.all.each do |foundation|
      table_name = foundation.database_table_name
      next unless ActiveRecord::Base.connection.table_exists?(table_name)

      db_cols = ActiveRecord::Base.connection.columns(table_name).map(&:name)
      db_cols -= ["id", "created_at", "updated_at"]

      meta_cols = foundation.columns.pluck(:column_name)

      orphans = db_cols - meta_cols
      missing = meta_cols - db_cols

      if orphans.any? || missing.any?
        issues << {
          foundation: foundation,
          orphans: orphans,
          missing: missing
        }
      end
    end

    issues
  end

  # Auto-sync drift for safe foundations (mirrors foundation:sync rake task logic)
  def auto_sync_drift(issues)
    fixes = { added: 0, removed: 0, skipped: 0 }

    issues.each do |issue|
      foundation = issue[:foundation]

      if SKIP_FOUNDATIONS.include?(foundation.name)
        fixes[:skipped] += 1
        next
      end

      table_name = foundation.database_table_name

      # Add orphaned columns to Foundation metadata
      issue[:orphans].each do |col_name|
        db_col = ActiveRecord::Base.connection.columns(table_name).find { |c| c.name == col_name }
        next unless db_col

        col_type = infer_column_type(db_col)
        foundation.columns.create!(
          name: col_name.titleize,
          column_name: col_name,
          column_type: col_type,
          position: foundation.columns.maximum(:position).to_i + 1,
          column_group: infer_column_group(col_name),
          searchable: [:string, :text].include?(db_col.type)
        )
        fixes[:added] += 1

        Rails.logger.info "[FoundationSyncMonitor] Auto-added: #{foundation.name}.#{col_name} (#{col_type})"
      rescue StandardError => e
        Rails.logger.error "[FoundationSyncMonitor] Failed to add #{foundation.name}.#{col_name}: #{e.message}"
      end

      # Remove stale metadata columns
      issue[:missing].each do |col_name|
        col = foundation.columns.find_by(column_name: col_name)
        next unless col

        col.destroy
        fixes[:removed] += 1

        Rails.logger.info "[FoundationSyncMonitor] Auto-removed stale: #{foundation.name}.#{col_name}"
      rescue StandardError => e
        Rails.logger.error "[FoundationSyncMonitor] Failed to remove #{foundation.name}.#{col_name}: #{e.message}"
      end
    end

    fixes
  end

  def infer_column_type(db_col)
    case db_col.type
    when :string
      return "email" if db_col.name.include?("email")
      return "phone" if db_col.name.include?("phone") && !db_col.name.include?("mobile")
      return "mobile" if db_col.name.include?("mobile")
      return "url" if db_col.name.include?("url") || db_col.name.include?("link")
      return "abn" if db_col.name.include?("abn") && !db_col.name.include?("abn_")
      return "postcode" if db_col.name == "postcode"
      "single_line_text"
    when :text
      db_col.array? ? "array_of_items" : "multiple_lines_text"
    when :integer, :bigint
      "whole_number"
    when :decimal, :float
      return "percentage" if db_col.name.include?("percent") || db_col.name.include?("rate")
      return "currency" if db_col.name =~ /price|cost|value|amount|receivable|payable/
      "number"
    when :boolean then "boolean"
    when :date then "date"
    when :datetime, :timestamp then "date_and_time"
    when :jsonb, :json then "structured_data"
    else "single_line_text"
    end
  end

  def infer_column_group(col_name)
    return "Xero Integration" if col_name.include?("xero")
    return "Business Details" if col_name =~ /abn|acn|company/
    return "Contact Information" if col_name =~ /address|phone|email|city|state|postcode/
    return "Personal Details" if col_name =~ /name|birth|photo|licence|passport/
    return "Banking" if col_name =~ /bank|bsb/
    return "System" if col_name =~ /deleted|is_|sync/
    "General"
  end
end
