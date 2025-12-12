# Daily job to monitor Foundation sync health
# Run via: FoundationSyncMonitorJob.perform_later
# Schedule in config/solid_queue_recurring.yml

class FoundationSyncMonitorJob < ApplicationJob
  queue_as :default

  def perform
    Rails.logger.info "[FoundationSyncMonitor] Starting daily sync check..."

    # Get all foundations with sync issues
    issues = find_sync_issues

    if issues.empty?
      Rails.logger.info "[FoundationSyncMonitor] ✅ All foundations in sync"
      return
    end

    total_orphans = issues.sum { |i| i[:orphans].count }
    total_missing = issues.sum { |i| i[:missing].count }

    # Log the issue
    Rails.logger.warn "[FoundationSyncMonitor] ⚠️  Sync drift detected:"
    Rails.logger.warn "  - #{issues.count} foundations out of sync"
    Rails.logger.warn "  - #{total_orphans} orphaned columns"
    Rails.logger.warn "  - #{total_missing} phantom columns"

    # Send alert (can add email/Slack notification here)
    alert_message = build_alert_message(issues, total_orphans, total_missing)

    # Log to Sentry if available
    if defined?(Sentry)
      Sentry.capture_message(
        "Foundation metadata drift detected",
        level: :warning,
        extra: {
          foundations_affected: issues.count,
          orphaned_columns: total_orphans,
          phantom_columns: total_missing,
          details: issues.map { |i|
            {
              foundation: i[:foundation].name,
              orphans: i[:orphans],
              missing: i[:missing]
            }
          }
        }
      )
    end

    Rails.logger.info "[FoundationSyncMonitor] Alert sent. Run 'rails foundation:sync' to fix."
  end

  private

  def find_sync_issues
    issues = []

    Foundation.all.each do |foundation|
      table_name = foundation.database_table_name

      # Skip if table doesn't exist
      next unless ActiveRecord::Base.connection.table_exists?(table_name)

      # Get actual DB columns (excluding auto-generated)
      db_cols = ActiveRecord::Base.connection.columns(table_name).map(&:name)
      db_cols -= [ "id", "created_at", "updated_at" ]

      # Get Foundation metadata columns
      meta_cols = foundation.columns.pluck(:column_name)

      # Find orphans and missing
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

  def build_alert_message(issues, total_orphans, total_missing)
    <<~MESSAGE
      🚨 Foundation Metadata Drift Detected

      #{issues.count} foundation(s) are out of sync:
      - #{total_orphans} columns exist in database but not in Foundation metadata
      - #{total_missing} columns registered in Foundation but don't exist in database

      Top affected foundations:
      #{issues.first(5).map { |i| "  - #{i[:foundation].name} (#{i[:orphans].count} orphans, #{i[:missing].count} phantom)" }.join("\n")}

      To fix: Run `rails foundation:sync` or deploy with auto-sync enabled.
    MESSAGE
  end
end
