# Deployment tasks for TEEEM
# These tasks run automatically during Heroku releases

namespace :deploy do
  desc "Run all deployment tasks (auto-sync, migrations, etc.)"
  task prepare: :environment do
    puts "\n" + ("=" * 80)
    puts "🚀 TEEEM Deployment Preparation"
    puts ("=" * 80)

    # 1. Run pending migrations
    begin
      # Rails 8 compatible: Use MigrationContext.needs_migration?
      migration_context = ActiveRecord::MigrationContext.new(ActiveRecord::Migrator.migrations_paths)
      if migration_context.needs_migration?
        puts "\n📦 Running pending migrations..."
        Rake::Task["db:migrate"].invoke
      else
        puts "\n✅ No pending migrations"
      end
    rescue => e
      puts "\n⚠️  Migration check failed: #{e.message}"
      puts "   Attempting to run migrations anyway..."
      Rake::Task["db:migrate"].invoke
    end

    # 2. Auto-sync Foundation metadata
    puts "\n🔄 Syncing Foundation metadata..."
    begin
      Rake::Task["foundation:health_check_auto_fix"].invoke
      puts "✅ Foundation sync complete"
    rescue => e
      puts "⚠️  Foundation sync warning: #{e.message}"
      puts "   (Deployment will continue, but run 'rails foundation:sync' manually)"
    end

    # 3. Restart recurring jobs (SolidQueue)
    if defined?(SolidQueue)
      puts "\n♻️  Reloading recurring jobs..."
      begin
        # Reload recurring schedule
        SolidQueue::RecurringTask.load_recurring_schedule
        puts "✅ Recurring jobs reloaded"
      rescue => e
        puts "⚠️  Could not reload recurring jobs: #{e.message}"
      end
    end

    puts "\n" + ("=" * 80)
    puts "✅ Deployment preparation complete!"
    puts ("=" * 80)
  end
end

# Hook into Heroku release phase
# Add to Procfile: release: bundle exec rails deploy:prepare
