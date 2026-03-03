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

    # 2. Reconcile system warehouse tabs across all tenants
    # FRC (Mar 2026): A migration used LIMIT 1 without tenant scoping, so only one
    # tenant got Sales/Site parent tabs. This prevents that class of bug permanently.
    # Idempotent and fast (<2s for 3 tenants). Runs inside the same boot as migrations.
    reconcile_system_tabs

    # 3. Version increment
    Rake::Task["release:increment_version"].invoke

    # 4. Queue setup
    Rake::Task["queue:setup"].invoke

    puts "Release complete"
  end

  def reconcile_system_tabs
    result = TenantConfigSyncService.reconcile_system_tabs!
    if result[:success]
      if (result[:created] || 0) > 0 || (result[:fixed] || 0) > 0
        puts "Reconciled system tabs: #{result[:created]} created, #{result[:fixed]} fixed"
      else
        puts "System tabs OK"
      end
    else
      puts "System tab reconciliation skipped: #{result[:error]}"
    end
  rescue => e
    # Non-fatal: log and continue deploy even if reconciliation fails
    puts "WARNING: System tab reconciliation failed: #{e.message}"
  end

  # Advisory lock prevents concurrent migration runs during pipeline promotion.
  # Staging/beta/production share the same DB and run release commands simultaneously.
  # Without the lock, two dynos can both see needs_migration?=true and race on db:migrate,
  # causing "Database table name already taken" (Sentry TEEEM-BACKEND-4P).
  MIGRATION_LOCK_ID = 0x5445454D_4D494752  # "TEEMMIGR" as hex

  def run_migrations
    migration_context = ActiveRecord::MigrationContext.new(ActiveRecord::Migrator.migrations_paths)
    unless migration_context.needs_migration?
      puts "No pending migrations"
      return
    end

    # pg_advisory_lock blocks until the lock is available (other dynos wait).
    # pg_advisory_unlock releases it so the next dyno can proceed.
    ActiveRecord::Base.connection.execute("SELECT pg_advisory_lock(#{MIGRATION_LOCK_ID})")
    begin
      # Re-check after acquiring lock - another dyno may have already migrated
      migration_context = ActiveRecord::MigrationContext.new(ActiveRecord::Migrator.migrations_paths)
      if migration_context.needs_migration?
        puts "Running pending migrations (advisory lock acquired)..."
        Rake::Task["db:migrate"].invoke
        puts "Migrations complete"
      else
        puts "Migrations already applied by another release dyno"
      end
    ensure
      ActiveRecord::Base.connection.execute("SELECT pg_advisory_unlock(#{MIGRATION_LOCK_ID})")
    end
  end
end
