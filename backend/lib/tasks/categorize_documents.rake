# Rake tasks for bulk document categorization using EntityTab SSoT
# SSoT: Uses BulkDocumentCategorizationService which matches folder_path to EntityTab.document_types

namespace :documents do
  desc "Preview categorization for all uncategorized corporate documents (dry run)"
  task preview_corporate: :environment do
    puts "=" * 80
    puts "CORPORATE DOCUMENT CATEGORIZATION PREVIEW"
    puts "=" * 80
    puts ""

    result = BulkDocumentCategorizationService.for_corporate(dry_run: true).categorize_all

    print_categorization_results(result, "Corporate Documents")
  end

  desc "Categorize all uncategorized corporate documents using EntityTab SSoT"
  task categorize_corporate: :environment do
    puts "=" * 80
    puts "CORPORATE DOCUMENT CATEGORIZATION"
    puts "=" * 80
    puts ""

    result = BulkDocumentCategorizationService.for_corporate.categorize_all

    print_categorization_results(result, "Corporate Documents")
  end

  desc "Force re-categorize ALL corporate documents (overwrites existing types)"
  task recategorize_corporate: :environment do
    puts "=" * 80
    puts "CORPORATE DOCUMENT RE-CATEGORIZATION (FORCE)"
    puts "=" * 80
    puts "⚠️  This will overwrite existing document_type_id values!"
    puts ""

    result = BulkDocumentCategorizationService.for_corporate(force: true).categorize_all

    print_categorization_results(result, "Corporate Documents")
  end

  desc "Categorize all uncategorized job documents using EntityTab SSoT"
  task categorize_jobs: :environment do
    puts "=" * 80
    puts "JOB DOCUMENT CATEGORIZATION"
    puts "=" * 80
    puts ""

    total_stats = { total: 0, categorized: 0, skipped: 0, failed: 0, recategorized: 0, already_correct: 0 }

    Job.find_each.with_index do |job, index|
      result = BulkDocumentCategorizationService.for_job(job).categorize_all
      stats = result[:stats]

      # Aggregate stats
      total_stats.each_key { |k| total_stats[k] += stats[k] }

      # Only print jobs with activity
      if stats[:categorized] > 0 || stats[:recategorized] > 0
        puts "Job #{job.code}: #{stats[:categorized]} categorized, #{stats[:recategorized]} recategorized"
      end

      # Progress indicator every 100 jobs
      print "." if index % 100 == 0
    end

    puts ""
    puts ""
    puts "=" * 80
    puts "SUMMARY"
    puts "=" * 80
    puts "Total documents processed: #{total_stats[:total]}"
    puts "  - Categorized:     #{total_stats[:categorized]}"
    puts "  - Re-categorized:  #{total_stats[:recategorized]}"
    puts "  - Already correct: #{total_stats[:already_correct]}"
    puts "  - Skipped:         #{total_stats[:skipped]}"
    puts "  - Failed:          #{total_stats[:failed]}"
  end

  desc "Categorize ALL documents (corporate + jobs) using EntityTab SSoT"
  task categorize_all: :environment do
    puts "=" * 80
    puts "BULK DOCUMENT CATEGORIZATION (ALL SCOPES)"
    puts "=" * 80
    puts ""

    # Corporate first
    puts "--- CORPORATE DOCUMENTS ---"
    corp_result = BulkDocumentCategorizationService.for_corporate.categorize_all
    print_categorization_results(corp_result, "Corporate")
    puts ""

    # Then jobs
    puts "--- JOB DOCUMENTS ---"
    Rake::Task["documents:categorize_jobs"].invoke
  end

  desc "Show categorization status for all document types"
  task status: :environment do
    puts "=" * 80
    puts "DOCUMENT CATEGORIZATION STATUS"
    puts "=" * 80
    puts ""

    # Corporate
    corp_total = CorporateCompanyDocument.count
    corp_null = CorporateCompanyDocument.where(document_type_id: nil).count
    corp_pct = corp_total > 0 ? ((corp_total - corp_null).to_f / corp_total * 100).round(1) : 0

    puts "Corporate Documents:"
    puts "  Total:        #{corp_total}"
    puts "  Categorized:  #{corp_total - corp_null} (#{corp_pct}%)"
    puts "  Uncategorized: #{corp_null}"
    puts ""

    # Jobs
    job_total = JobDocument.count
    job_null = JobDocument.where(document_type_id: nil).count
    job_pct = job_total > 0 ? ((job_total - job_null).to_f / job_total * 100).round(1) : 0

    puts "Job Documents:"
    puts "  Total:        #{job_total}"
    puts "  Categorized:  #{job_total - job_null} (#{job_pct}%)"
    puts "  Uncategorized: #{job_null}"
    puts ""

    # EntityTabs with document types
    puts "EntityTabs with linked DocumentTypes:"
    %w[job corporate_entity contact].each do |scope|
      tabs = EntityTab.for_scope(scope).for_group('documents').enabled
      with_types = tabs.select { |t| t.document_type_ids.any? }.count
      puts "  #{scope}: #{with_types}/#{tabs.count} tabs have linked types"
    end
  end
end

# Helper method for printing results (defined outside namespace for reuse)
def print_categorization_results(result, label)
  stats = result[:stats]
  puts ""
  puts "=" * 80
  puts "#{label.upcase} CATEGORIZATION #{result[:dry_run] ? '(DRY RUN)' : 'COMPLETE'}"
  puts "=" * 80
  puts "Total documents:  #{stats[:total]}"
  puts "  - Categorized:     #{stats[:categorized]}"
  puts "  - Re-categorized:  #{stats[:recategorized]}"
  puts "  - Already correct: #{stats[:already_correct]}"
  puts "  - Skipped:         #{stats[:skipped]}"
  puts "  - Failed:          #{stats[:failed]}"

  if result[:dry_run]
    puts ""
    puts "This was a DRY RUN. No changes were made."
    puts "Run without dry_run to apply changes."
  end
end
