# Foundation Health Check for CI/CD
# Fails if Foundation metadata is out of sync with database schema
# Add to your CI/CD pipeline: rails foundation:health_check

namespace :foundation do
  desc "Health check: Fail if Foundation metadata is out of sync (for CI/CD)"
  task health_check: :environment do
    puts "\n🏥 Running Foundation Health Check..."
    puts "=" * 80

    issues = find_foundation_sync_issues

    if issues.empty?
      puts "✅ PASS: All foundations are in sync!"
      puts "=" * 80
      exit 0
    else
      puts "❌ FAIL: Foundation metadata is out of sync with database schema"
      puts ""
      puts "📊 Summary:"
      puts "   #{issues.count} foundation(s) with sync issues"
      total_orphans = issues.sum { |i| i[:orphans].count }
      total_missing = issues.sum { |i| i[:missing].count }
      puts "   #{total_orphans} orphaned column(s) (in DB but not in Foundation)"
      puts "   #{total_missing} missing column(s) (in Foundation but not in DB)"
      puts ""
      puts "🔧 To fix:"
      puts "   Run: rails foundation:sync"
      puts "=" * 80

      exit 1  # Fail CI/CD build
    end
  end

  desc "Health check with auto-fix (for deployment)"
  task health_check_auto_fix: :environment do
    puts "\n🏥 Running Foundation Health Check (auto-fix mode)..."

    issues = find_foundation_sync_issues

    if issues.empty?
      puts "✅ All foundations are in sync!"
    else
      puts "⚠️  Found #{issues.count} foundation(s) with sync issues"
      puts "🔧 Auto-fixing..."

      # Run full sync
      Rake::Task["foundation:sync"].invoke

      puts "✅ Auto-fix complete!"
    end
  end
end
