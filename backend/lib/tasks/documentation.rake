# DEPRECATED: DocumentationCategory has been replaced by DocumentType + SmScheduleMasterDocumentType
# These tasks are kept for backward compatibility but will output deprecation warnings.
#
# The new system uses:
# - DocumentType: Define document types with naming conventions and folder paths
# - SmScheduleMasterDocumentType: Link document types to schedule master tasks
# - Workflow triggers on task start/complete
# - GET task spawning on task completion

namespace :documentation do
  desc "DEPRECATED: Backfill construction documentation tabs from global categories"
  task backfill_tabs: :environment do
    puts "=" * 60
    puts "DEPRECATED: DocumentationCategory has been removed."
    puts ""
    puts "The new system uses DocumentType + SmScheduleMasterDocumentType."
    puts "Configure document types in Admin > Document Types, then link"
    puts "them to Schedule Master tasks for automatic GET task spawning."
    puts "=" * 60
  end

  desc "DEPRECATED: Sync a specific category to all jobs"
  task sync_category: :environment do
    puts "=" * 60
    puts "DEPRECATED: DocumentationCategory has been removed."
    puts ""
    puts "The new system uses DocumentType + SmScheduleMasterDocumentType."
    puts "Configure document types in Admin > Document Types, then link"
    puts "them to Schedule Master tasks for automatic GET task spawning."
    puts "=" * 60
  end
end
