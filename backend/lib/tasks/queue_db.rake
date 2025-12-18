# frozen_string_literal: true

# Rake tasks for managing the separate queue database.
# Part of Option C architectural refactor to prevent database connection exhaustion.
#
# Usage:
#   rails queue:setup       - Create tables in queue database
#   rails queue:migrate     - Run pending queue migrations
#   rails queue:status      - Show queue database status
#   rails queue:migrate_data - Migrate data from primary to queue DB (one-time)
#
namespace :queue do
  desc "Setup queue database (create tables)"
  task setup: :environment do
    puts "Setting up queue database..."

    # Check if QUEUE_DATABASE_URL is set
    queue_url = ENV["QUEUE_DATABASE_URL"]
    if queue_url.nil? || queue_url == ENV["DATABASE_URL"]
      puts "  QUEUE_DATABASE_URL not set or same as DATABASE_URL"
      puts "  Using primary database for queue (this is fine for development)"
    else
      puts "  Using separate queue database: #{queue_url.gsub(/:[^:@]+@/, ':***@')}"
    end

    # Run migrations on queue database
    ActiveRecord::Base.connected_to(database: :queue) do
      context = ActiveRecord::MigrationContext.new(
        Rails.root.join("db/queue_migrate"),
        ActiveRecord::Base.connection.schema_migration
      )

      if context.needs_migration?
        puts "  Running #{context.migrations.count} migration(s)..."
        context.migrate
        puts "  Migrations completed!"
      else
        puts "  No pending migrations."
      end
    end

    # Reload SolidQueue recurring tasks
    if defined?(SolidQueue)
      puts "  Reloading recurring tasks..."
      Rake::Task["solid_queue:recurring:load"].invoke rescue nil
    end

    puts "Queue database setup complete!"
  end

  desc "Run pending queue database migrations"
  task migrate: :environment do
    puts "Running queue database migrations..."
    ActiveRecord::Base.connected_to(database: :queue) do
      context = ActiveRecord::MigrationContext.new(
        Rails.root.join("db/queue_migrate"),
        ActiveRecord::Base.connection.schema_migration
      )
      context.migrate
    end
    puts "Done!"
  end

  desc "Show queue database migration status"
  task status: :environment do
    puts "Queue Database Status"
    puts "=" * 50

    queue_url = ENV["QUEUE_DATABASE_URL"]
    if queue_url.nil? || queue_url == ENV["DATABASE_URL"]
      puts "URL: Using primary database (QUEUE_DATABASE_URL not set)"
    else
      puts "URL: #{queue_url.gsub(/:[^:@]+@/, ':***@')}"
    end

    ActiveRecord::Base.connected_to(database: :queue) do
      context = ActiveRecord::MigrationContext.new(
        Rails.root.join("db/queue_migrate"),
        ActiveRecord::Base.connection.schema_migration
      )

      puts "Pending migrations: #{context.open.pending_migrations.count}"
      puts "Applied migrations: #{context.get_all_versions.count}"

      # Show SolidQueue stats if tables exist
      if ActiveRecord::Base.connection.table_exists?(:solid_queue_jobs)
        jobs_count = ActiveRecord::Base.connection.execute("SELECT COUNT(*) FROM solid_queue_jobs").first["count"]
        ready_count = ActiveRecord::Base.connection.execute("SELECT COUNT(*) FROM solid_queue_ready_executions").first["count"]
        failed_count = ActiveRecord::Base.connection.execute("SELECT COUNT(*) FROM solid_queue_failed_executions").first["count"]

        puts "\nSolidQueue Stats:"
        puts "  Total jobs: #{jobs_count}"
        puts "  Ready to run: #{ready_count}"
        puts "  Failed: #{failed_count}"
      else
        puts "\nSolidQueue tables not yet created."
      end
    end
  end

  desc "Migrate data from primary to queue database (one-time migration)"
  task migrate_data: :environment do
    puts "Migrating SolidQueue data from primary to queue database..."
    puts "WARNING: This should only be run once during the migration cutover."
    puts ""

    queue_url = ENV["QUEUE_DATABASE_URL"]
    if queue_url.nil? || queue_url == ENV["DATABASE_URL"]
      puts "ERROR: QUEUE_DATABASE_URL must be different from DATABASE_URL"
      puts "       Set QUEUE_DATABASE_URL to the new queue database URL"
      exit 1
    end

    # Tables to migrate
    tables = %w[
      solid_queue_jobs
      solid_queue_blocked_executions
      solid_queue_claimed_executions
      solid_queue_failed_executions
      solid_queue_pauses
      solid_queue_processes
      solid_queue_ready_executions
      solid_queue_recurring_executions
      solid_queue_recurring_tasks
      solid_queue_scheduled_executions
      solid_queue_semaphores
    ]

    tables.each do |table|
      puts "Migrating #{table}..."

      # Read from primary
      primary_data = ActiveRecord::Base.connected_to(database: :primary) do
        ActiveRecord::Base.connection.execute("SELECT * FROM #{table}").to_a
      end

      next if primary_data.empty?

      # Write to queue
      ActiveRecord::Base.connected_to(database: :queue) do
        primary_data.each do |row|
          columns = row.keys.join(", ")
          values = row.values.map { |v| ActiveRecord::Base.connection.quote(v) }.join(", ")
          ActiveRecord::Base.connection.execute(
            "INSERT INTO #{table} (#{columns}) VALUES (#{values}) ON CONFLICT DO NOTHING"
          )
        end
      end

      puts "  Migrated #{primary_data.count} records"
    end

    puts "\nData migration complete!"
    puts "Next steps:"
    puts "1. Verify data in queue database: rails queue:status"
    puts "2. Scale worker=0, then restart dynos"
    puts "3. Scale worker=1 to start using new queue database"
  end
end
