# Deployment tasks for TEEEM
# Runs automatically during Heroku release phase
# Procfile: release: bundle exec rails deploy:prepare
#
# Only migrations belong here. Everything else either:
# - Runs on worker boot (SolidQueue recurring jobs)
# - Is a manual utility task (foundation:sync, warehouse:ensure_folders)

namespace :deploy do
  desc "Run pending migrations (Heroku release phase)"
  task prepare: :environment do
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
