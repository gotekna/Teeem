# frozen_string_literal: true

namespace :sharepoint do
  namespace :robs_fix do
    desc "Discover what's in the 'rob fix' folder and match to jobs"
    task discover: :environment do
      puts "🔍 Discovering 'rob fix' folder contents..."
      puts ""

      service = RobsFixMigrationService.new
      discovered = service.discover(dry_run: true)

      puts ""
      puts "To migrate a specific job, run:"
      puts "  bin/rails sharepoint:robs_fix:test JOB_ID=<id>"
      puts ""
      puts "To migrate all discovered jobs (DRY RUN):"
      puts "  bin/rails sharepoint:robs_fix:migrate"
      puts ""
      puts "To migrate all discovered jobs (LIVE):"
      puts "  bin/rails sharepoint:robs_fix:migrate DRY_RUN=false"
    end

    desc "Test migration with ONE job (dry run by default)"
    task test: :environment do
      job_id = ENV["JOB_ID"]

      unless job_id.present?
        puts "❌ Usage: bin/rails sharepoint:robs_fix:test JOB_ID=69"
        exit 1
      end

      dry_run = ENV["DRY_RUN"] != "false"

      puts "🧪 Testing migration for Job #{job_id}"
      puts "Mode: #{dry_run ? 'DRY RUN' : 'LIVE'}"
      puts ""

      service = RobsFixMigrationService.new
      results = service.migrate_single_job(job_id.to_i, dry_run: dry_run)

      if dry_run && results[:migrated].any?
        puts ""
        puts "To execute this migration for real, run:"
        puts "  bin/rails sharepoint:robs_fix:test JOB_ID=#{job_id} DRY_RUN=false"
      end
    end

    desc "Migrate all discovered jobs from 'rob fix' folder"
    task migrate: :environment do
      dry_run = ENV["DRY_RUN"] != "false"

      puts "🚀 Running full migration from 'rob fix' folder"
      puts "Mode: #{dry_run ? 'DRY RUN' : 'LIVE'}"
      puts ""

      if !dry_run
        puts "⚠️  LIVE MODE: Files will be moved!"
        puts "Press Ctrl+C to cancel, or wait 5 seconds..."
        sleep 5
      end

      service = RobsFixMigrationService.new
      results = service.run(dry_run: dry_run)

      if dry_run && results[:migrated].any?
        puts ""
        puts "To execute this migration for real, run:"
        puts "  bin/rails sharepoint:robs_fix:migrate DRY_RUN=false"
      end
    end

    desc "Run AI analysis on migrated documents"
    task ai_analyze: :environment do
      puts "🤖 Running AI analysis on migrated documents..."
      puts ""

      # Find documents that were migrated (have source: robs_fix_migration marker)
      # For now, we'll analyze recent job documents that don't have AI names yet
      docs_without_ai = JobDocument.where(ai_proposed_name: [nil, ""])
                                    .where.not(file_name: [nil, ""])
                                    .order(created_at: :desc)
                                    .limit(100)

      if docs_without_ai.empty?
        puts "✅ No documents need AI analysis."
        exit 0
      end

      puts "Found #{docs_without_ai.count} documents without AI analysis"
      puts ""

      docs_without_ai.each do |doc|
        puts "  📄 Job #{doc.job_id}: #{doc.file_name}"
        if defined?(JobDocumentAiAnalyzerJob)
          JobDocumentAiAnalyzerJob.perform_later(doc.id)
        end
      end

      puts ""
      puts "✅ Queued #{docs_without_ai.count} documents for AI analysis"
    end

    desc "Show migration status/summary"
    task status: :environment do
      puts "=== ROB FIX MIGRATION STATUS ==="
      puts ""

      # Count migrated documents by looking at file patterns
      # This is an approximation since we don't have a direct migration marker yet
      recent_docs = JobDocument.where("created_at > ?", 1.week.ago).count

      puts "Recent documents (last week): #{recent_docs}"
      puts ""

      # Show discovery status
      puts "Running discovery..."
      service = RobsFixMigrationService.new
      discovered = service.discover(dry_run: false)

      puts ""
      puts "Jobs with pending source folders:"
      discovered.each do |job_id, data|
        folders = data[:source_folders].map { |f| f[:name] }.join(", ")
        puts "  Job #{job_id}: #{folders}"
      end
    end
  end
end
