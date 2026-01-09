# frozen_string_literal: true

# Rake tasks for managing the separate queue database.
# Part of Option C architectural refactor to prevent database connection exhaustion.
#
# NOTE: Rails 8 handles multi-database migrations automatically via database.yml
# migrations_paths config. These tasks are now simplified to just verify status.
#
# Usage:
#   rails queue:setup       - Verify queue database is ready
#   rails queue:status      - Show queue database status
#
namespace :queue do
  desc "Verify queue database is set up"
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

    # Rails 8: Multi-database migrations are handled automatically by db:migrate
    # based on migrations_paths in database.yml. Just verify tables exist.
    begin
      queue_config = ActiveRecord::Base.configurations.configs_for(env_name: Rails.env, name: "queue")
      if queue_config
        # Establish temporary connection to queue database
        queue_conn = ActiveRecord::Base.establish_connection(queue_config).connection

        if queue_conn.table_exists?(:solid_queue_jobs)
          puts "  ✅ Queue tables exist"
        else
          puts "  ⚠️  Queue tables not found - run 'rails db:migrate' to create them"
        end

        # Restore primary connection
        ActiveRecord::Base.establish_connection(:primary)
      else
        puts "  Using primary database connection for queue"
      end
    rescue => e
      puts "  ⚠️  Could not verify queue database: #{e.message}"
    end

    puts "Queue database setup complete!"
  end

  desc "Show queue database status"
  task status: :environment do
    puts "Queue Database Status"
    puts "=" * 50

    queue_url = ENV["QUEUE_DATABASE_URL"]
    if queue_url.nil? || queue_url == ENV["DATABASE_URL"]
      puts "URL: Using primary database (QUEUE_DATABASE_URL not set)"
    else
      puts "URL: #{queue_url.gsub(/:[^:@]+@/, ':***@')}"
    end

    begin
      queue_config = ActiveRecord::Base.configurations.configs_for(env_name: Rails.env, name: "queue")
      if queue_config
        queue_conn = ActiveRecord::Base.establish_connection(queue_config).connection

        # Show SolidQueue stats if tables exist
        if queue_conn.table_exists?(:solid_queue_jobs)
          jobs_count = queue_conn.execute("SELECT COUNT(*) FROM solid_queue_jobs").first["count"]
          ready_count = queue_conn.execute("SELECT COUNT(*) FROM solid_queue_ready_executions").first["count"]
          failed_count = queue_conn.execute("SELECT COUNT(*) FROM solid_queue_failed_executions").first["count"]

          puts "\nSolidQueue Stats:"
          puts "  Total jobs: #{jobs_count}"
          puts "  Ready to run: #{ready_count}"
          puts "  Failed: #{failed_count}"
        else
          puts "\nSolidQueue tables not yet created."
          puts "Run 'rails db:migrate' to create them."
        end

        # Restore primary connection
        ActiveRecord::Base.establish_connection(:primary)
      else
        puts "\nNo separate queue database configured."
      end
    rescue => e
      puts "Error: #{e.message}"
    end
  end
end
