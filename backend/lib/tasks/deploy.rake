# Deployment tasks for TEEEM
# Runs automatically during Heroku release phase
# Procfile: release: bundle exec rails deploy:release
#
# deploy:release runs all release steps in a SINGLE Rails boot to minimize
# DB connections during deploy (FRC: 3 envs share 40-connection limit).
#
# Previously the Procfile chained 3 separate `rails` commands, each booting
# Rails and opening its own connection pools. During pipeline promotions this
# caused PG::ConnectionBad (too many connections for role).

namespace :deploy do
  desc "Run pending migrations (standalone - use deploy:release instead)"
  task prepare: :environment do
    run_migrations
  end

  desc "Combined release task - single Rails boot (SSoT for Heroku release phase)"
  task release: :environment do
    # 1. Migrations
    run_migrations

    # 2. Version increment
    Rake::Task["release:increment_version"].invoke

    # 3. Queue setup
    Rake::Task["queue:setup"].invoke

    puts "Release complete"
  end

  def run_migrations
    migration_context = ActiveRecord::MigrationContext.new(ActiveRecord::Migrator.migrations_paths)
    if migration_context.needs_migration?
      puts "Running pending migrations..."
      Rake::Task["db:migrate"].invoke
      puts "Migrations complete"
    else
      puts "No pending migrations"
    end
  end
end
