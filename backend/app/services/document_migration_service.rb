# frozen_string_literal: true

# DocumentMigrationService - Handles document migration between storage providers
#
# This is a stub service for the migration UI. Full implementation pending.
#
# Used by:
#   - Api::V1::OrganizationController#estimate_migration
#   - Api::V1::OrganizationController#document_migration_status
#   - Api::V1::OrganizationController#start_document_migration
#
class DocumentMigrationService
  class << self
    # Get current migration status
    # @return [Hash] Status information matching frontend MigrationStatus interface
    def migration_status
      current_provider = WarehouseProvider.instance&.provider_type || "none"

      {
        # Match frontend MigrationStatus interface
        total_documents: 0,
        grand_total: 0,
        migration_in_progress: false,
        status_counts: {
          pending: 0,
          in_progress: 0,
          completed: 0,
          failed: 0,
          not_migrated: 0
        },
        provider_breakdown: {
          current_provider => 0
        },
        progress_percent: 0,
        recent_failures: [],
        # Additional context
        current_provider: current_provider,
        started_at: nil,
        error: nil
      }
    end

    # Estimate migration from a provider
    # @param from [String] Source provider name
    # @return [Hash] Estimation details
    def estimate_migration(from:)
      {
        from_provider: from,
        total_files: 0,
        total_size_bytes: 0,
        total_size_display: "0 B",
        estimated_time_seconds: 0,
        estimated_time_display: "< 1 minute"
      }
    end

    # Start a migration (stub - not implemented)
    # @param from [String] Source provider
    # @param to [String] Destination provider
    # @param delete_source [Boolean] Whether to delete source files after migration
    # @return [Hash] Result
    def start_migration(from:, to:, delete_source: false)
      {
        success: false,
        error: "Document migration is not yet implemented"
      }
    end

    # Cancel a running migration (stub - not implemented)
    # @return [Hash] Result
    def cancel_migration
      {
        success: false,
        error: "No migration in progress"
      }
    end

    # Retry failed migrations (stub - not implemented)
    # @return [Hash] Result
    def retry_failed
      {
        success: false,
        error: "No failed migrations to retry"
      }
    end
  end
end
